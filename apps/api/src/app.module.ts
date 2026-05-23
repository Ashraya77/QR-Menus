import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MenusModule } from './menus/menus.module';
import { TablesModule } from './tables/tables.module';
import { TenantsModule } from './tenants/tenants.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SystemRoleGuard } from '../common/guards/system-role.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantRoleGuard } from '../common/guards/tenant-role.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@Module({
  imports: [AuthModule, TenantsModule, MenusModule, TablesModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SystemRoleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantRoleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
