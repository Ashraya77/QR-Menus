import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TenantRoles } from '../../common/decorators/tenant-roles.decorator';
import { MenusService } from './menus.service';

@ApiTags('Menus')
@Controller()
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Public()
  @ApiOperation({ summary: 'Get public tenant menu for a static QR' })
  @ApiParam({ name: 'tenantSlug', example: 'cafe-aroma' })
  @ApiResponse({
    status: 200,
    description: 'Public active menu data for a tenant.',
  })
  @Get('public/:tenantSlug/menu')
  getPublicMenu(@Param('tenantSlug') tenantSlug: string) {
    return this.menus.getPublicMenu(tenantSlug);
  }

  @Public()
  @ApiOperation({ summary: 'Get public menu for a table-specific QR' })
  @ApiParam({ name: 'tenantSlug', example: 'cafe-aroma' })
  @ApiParam({ name: 'tableCode', example: 'tbl_x7k29a' })
  @ApiResponse({
    status: 200,
    description:
      'Public active menu data resolved from tenant slug and table code.',
    schema: {
      example: {
        tenant: {
          id: 'tenant_123',
          name: 'Cafe Aroma',
          slug: 'cafe-aroma',
          logoUrl: null,
          qrUrl: 'http://localhost:3000/t/cafe-aroma',
        },
        table: {
          id: 'table_123',
          label: 'Table 5',
          code: 'tbl_x7k29a',
          qrUrl: 'http://localhost:3000/t/cafe-aroma/table/tbl_x7k29a',
        },
        menu: {
          id: 'menu_123',
          name: 'Main Menu',
          categories: [],
        },
      },
    },
  })
  @Get('public/:tenantSlug/table/:tableCode/menu')
  getPublicTableMenu(
    @Param('tenantSlug') tenantSlug: string,
    @Param('tableCode') tableCode: string,
  ) {
    return this.menus.getPublicTableMenu(tenantSlug, tableCode);
  }

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN, TenantRole.STAFF)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Selected tenant id.',
    required: true,
  })
  @ApiOperation({ summary: 'List menus for selected tenant' })
  @Get('menus')
  getTenantMenus(@CurrentTenant() tenant: { id: string }) {
    return this.menus.getTenantMenus(tenant.id);
  }
}
