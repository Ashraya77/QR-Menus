import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole, TenantRole } from '@prisma/client';
import { TENANT_ROLES_KEY } from '../decorators/tenant-roles.decorator';

@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[]>(
      TENANT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.systemRole === SystemRole.SUPER_ADMIN) return true;

    const membership = request.membership ?? request.tenantMember;

    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient tenant role');
    }

    return true;
  }
}
