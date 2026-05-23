import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus, TenantStatus } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma.service';
import { PasswordService } from '../../src/auth/password.service';
import { API_SCOPES_KEY } from '../decorators/api-scopes.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      API_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes?.length) return true;

    const request = context.switchToHttp().getRequest();
    const rawKey = this.extractApiKey(request);
    const { prefix, secret } = this.parseApiKey(rawKey);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyPrefix: prefix,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        tenant: true,
      },
    });

    if (!apiKey || !(await this.passwords.verify(apiKey.keyHash, secret))) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (
      apiKey.tenant.status !== TenantStatus.ACTIVE ||
      (apiKey.tenant.subscriptionStatus !== SubscriptionStatus.ACTIVE &&
        apiKey.tenant.subscriptionStatus !== SubscriptionStatus.TRIALING)
    ) {
      throw new ForbiddenException('Tenant is not allowed to use API keys');
    }

    if (!requiredScopes.every((scope) => apiKey.scopes.includes(scope))) {
      throw new ForbiddenException('API key scope is not allowed');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    request.apiKey = apiKey;
    request.tenant = apiKey.tenant;

    return true;
  }

  private extractApiKey(request: {
    headers: Record<string, string | string[] | undefined>;
  }) {
    const header = request.headers['x-api-key'];

    if (typeof header === 'string') return header;

    const authorization = request.headers.authorization;

    if (
      typeof authorization === 'string' &&
      authorization.toLowerCase().startsWith('bearer ')
    ) {
      return authorization.slice('bearer '.length).trim();
    }

    throw new UnauthorizedException('API key is required');
  }

  private parseApiKey(rawKey: string) {
    const [prefix, secret, extra] = rawKey.split('.');

    if (!prefix || !secret || extra !== undefined) {
      throw new UnauthorizedException('Invalid API key');
    }

    return { prefix, secret };
  }
}
