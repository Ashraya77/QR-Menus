import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
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

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Selected tenant id.',
    required: true,
  })
  @ApiOperation({ summary: 'Create a menu for selected tenant' })
  @ApiBody({ type: CreateMenuDto })
  @Post('menus')
  createMenu(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateMenuDto,
  ) {
    return this.menus.createMenu(tenant.id, dto);
  }

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Selected tenant id.',
    required: true,
  })
  @ApiOperation({ summary: 'Update a menu for selected tenant' })
  @ApiParam({ name: 'id', example: 'menu_123' })
  @ApiBody({ type: UpdateMenuDto })
  @Put('menus/:id')
  updateMenu(
    @CurrentTenant() tenant: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menus.updateMenu(tenant.id, id, dto);
  }

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Tenant-Id',
    description: 'Selected tenant id.',
    required: true,
  })
  @ApiOperation({ summary: 'Delete a menu for selected tenant' })
  @ApiParam({ name: 'id', example: 'menu_123' })
  @Delete('menus/:id')
  deleteMenu(@CurrentTenant() tenant: { id: string }, @Param('id') id: string) {
    return this.menus.deleteMenu(tenant.id, id);
  }
}
