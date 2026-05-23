import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SystemRole, TenantRole } from '@prisma/client';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SystemRoles } from '../../common/decorators/system-roles.decorator';
import { TenantRoles } from '../../common/decorators/tenant-roles.decorator';
import type { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN, TenantRole.STAFF)
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Selected tenant id.',
    required: true,
  })
  @ApiOperation({ summary: 'Get selected tenant details and static QR URL' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        id: 'tenant_123',
        name: 'Cafe Aroma',
        slug: 'cafe-aroma',
        logoUrl: null,
        status: 'ACTIVE',
        qrUrl: 'http://localhost:3000/t/cafe-aroma',
      },
    },
  })
  @Get('current')
  getCurrentTenant(
    @CurrentTenant()
    tenant: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      status: 'ACTIVE' | 'SUSPENDED';
    },
  ) {
    return this.tenants.getCurrentTenant(tenant);
  }

  @SystemRoles(SystemRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create tenant and owner user' })
  @ApiBody({ type: CreateTenantDto })
  @Post()
  createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtUser) {
    return this.tenants.createTenant(dto, user);
  }

  @ApiOperation({ summary: 'Create tenant member' })
  @ApiParam({ name: 'tenantId', example: 'tenant_123' })
  @ApiBody({ type: CreateTenantMemberDto })
  @TenantRoles(TenantRole.OWNER)
  @Post(':tenantId/members')
  createMember(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTenantMemberDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tenants.createMember(tenantId, dto, user);
  }
}
