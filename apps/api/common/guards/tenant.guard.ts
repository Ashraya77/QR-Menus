import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberStatus, SystemRole, TenantStatus } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma.service';
import { TENANT_ROLES_KEY } from '../decorators/tenant-roles.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiresTenant = this.reflector.getAllAndOverride(TENANT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresTenant?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const tenantId = this.getTenantId(request);
    const tenantSlug = this.getTenantSlug(request);

    if (!tenantId && !tenantSlug) {
      throw new UnauthorizedException('Tenant id is required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: tenantId ? { id: tenantId } : { slug: tenantSlug },
    });

    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException('Tenant is not active');
    }

    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      request.tenant = tenant;
      request.tenantMember = null;
      request.membership = null;
      return true;
    }

    const membership = await this.prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
        status: MemberStatus.ACTIVE,
        tenant: {
          status: TenantStatus.ACTIVE,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Active tenant membership required');
    }

    request.tenant = tenant;
    request.tenantMember = membership;
    request.membership = membership;

    return true;
  }

  private getTenantId(request: {
    params?: Record<string, string | undefined>;
    headers?: Record<string, string | string[] | undefined>;
  }) {
    const fromParam = request.params?.tenantId;
    const fromHeader = request.headers?.['x-tenant-id'];

    if (typeof fromParam === 'string' && fromParam.trim()) {
      return fromParam.trim();
    }

    if (typeof fromHeader === 'string' && fromHeader.trim()) {
      return fromHeader.trim();
    }

    return undefined;
  }

  private getTenantSlug(request: {
    params?: Record<string, string | undefined>;
  }) {
    const slug = request.params?.slug ?? request.params?.tenantSlug;

    return typeof slug === 'string' && slug.trim() ? slug.trim() : undefined;
  }
}
