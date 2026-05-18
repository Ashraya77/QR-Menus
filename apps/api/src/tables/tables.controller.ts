import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import type { Tenant } from '@prisma/client';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantRoles } from '../../common/decorators/tenant-roles.decorator';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TablesService } from './tables.service';

@ApiTags('Tables')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Tenant-Id',
  description: 'Selected tenant id.',
  required: true,
})
@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
  @ApiOperation({ summary: 'Create a tenant table/location QR' })
  @ApiBody({ type: CreateTableDto })
  @ApiResponse({
    status: 201,
    description: 'Table created with a stable public QR URL.',
    schema: {
      example: {
        id: 'table_123',
        label: 'Table 5',
        code: 'tbl_x7k29a',
        isActive: true,
        tenantId: 'tenant_123',
        qrUrl: 'http://localhost:3000/t/cafe-aroma/table/tbl_x7k29a',
      },
    },
  })
  @Post()
  create(@CurrentTenant() tenant: Tenant, @Body() dto: CreateTableDto) {
    // The frontend/admin dashboard can render this qrUrl with a QR library.
    return this.tables.create(tenant, dto);
  }

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN, TenantRole.STAFF)
  @ApiOperation({ summary: 'List tenant tables/locations' })
  @ApiResponse({
    status: 200,
    description: 'Tables with QR URLs.',
    schema: {
      example: [
        {
          id: 'table_123',
          label: 'Table 5',
          code: 'tbl_x7k29a',
          isActive: true,
          tenantId: 'tenant_123',
          qrUrl: 'http://localhost:3000/t/cafe-aroma/table/tbl_x7k29a',
        },
      ],
    },
  })
  @Get()
  findAll(@CurrentTenant() tenant: Tenant) {
    return this.tables.findAll(tenant);
  }

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
  @ApiOperation({ summary: 'Update a table/location label or active status' })
  @ApiParam({ name: 'id', example: 'table_123' })
  @ApiBody({ type: UpdateTableDto })
  @Patch(':id')
  update(
    @CurrentTenant() tenant: Tenant,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tables.update(tenant, id, dto);
  }

  @TenantRoles(TenantRole.OWNER, TenantRole.ADMIN)
  @ApiOperation({ summary: 'Soft-disable a table/location QR' })
  @ApiParam({ name: 'id', example: 'table_123' })
  @Delete(':id')
  remove(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.tables.remove(tenant, id);
  }
}
