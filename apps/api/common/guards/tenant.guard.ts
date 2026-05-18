import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
    const requiresTenant = this.reflector.getAllAndOverride(
      TENANT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresTenant?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const tenantId = request.headers['x-tenant-id'];

    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new UnauthorizedException('X-Tenant-Id header is required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException('Tenant is not active');
    }

    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      request.tenant = tenant;
      request.tenantMember = null;
      return true;
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId,
        },
      },
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('Active tenant membership required');
    }

    request.tenant = tenant;
    request.tenantMember = membership;

    return true;
  }
}
