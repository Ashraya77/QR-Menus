import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SYSTEM_ROLES_KEY } from '../decorators/system-roles.decorator';
import { SystemRole } from '@prisma/client';

@Injectable()
export class SystemRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      SYSTEM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!requiredRoles.includes(user.systemRole)) {
      throw new ForbiddenException('Insufficient system role');
    }

    return true;
  }
}
