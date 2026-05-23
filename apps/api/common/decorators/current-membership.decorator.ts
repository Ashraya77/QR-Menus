import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentMembership = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.membership ?? request.tenantMember;
  },
);
