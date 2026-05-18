import { Controller, Get, Param } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TenantRoles } from '../../common/decorators/tenant-roles.decorator';
import { MenusService } from './menus.service';

@Controller()
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Public()
  @Get('public/:tenantSlug/menu')
  getPublicMenu(@Param('tenantSlug') tenantSlug: string) {
    return this.menus.getPublicMenu(tenantSlug);
  }

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN, TenantRole.STAFF)
  @Get('menus')
  getTenantMenus(@CurrentTenant() tenant: { id: string }) {
    return this.menus.getTenantMenus(tenant.id);
  }
}
