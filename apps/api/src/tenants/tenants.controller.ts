import { Body, Controller, Param, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SystemRoles } from '../../common/decorators/system-roles.decorator';
import type { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @SystemRoles(SystemRole.SUPER_ADMIN)
  @Post()
  createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtUser) {
    return this.tenants.createTenant(dto, user);
  }

  @Post(':tenantId/members')
  createMember(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTenantMemberDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenants.createMember(tenantId, dto, user);
  }
}
