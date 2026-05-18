import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma, Table, Tenant } from '@prisma/client';
import { buildTableQrUrl } from '../../common/utils/qr-url';
import { PrismaService } from '../database/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

const TABLE_CODE_PREFIX = 'tbl_';
const TABLE_CODE_BYTES = 9;

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenant: Tenant, dto: CreateTableDto) {
    const label = this.normalizeLabel(dto.label);
    const table = await this.createTableWithCode(tenant.id, label);

    return this.withQrUrl(table, tenant.slug);
  }

  async findAll(tenant: Tenant) {
    const tables = await this.prisma.table.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
    });

    return tables.map((table) => this.withQrUrl(table, tenant.slug));
  }

  async update(tenant: Tenant, tableId: string, dto: UpdateTableDto) {
    await this.ensureTenantTable(tenant.id, tableId);

    try {
      const table = await this.prisma.table.update({
        where: { id: tableId },
        data: {
          ...(dto.label !== undefined
            ? { label: this.normalizeLabel(dto.label) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      return this.withQrUrl(table, tenant.slug);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Table label already exists');
      }

      throw error;
    }
  }

  async remove(tenant: Tenant, tableId: string) {
    await this.ensureTenantTable(tenant.id, tableId);

    const table = await this.prisma.table.update({
      where: { id: tableId },
      data: { isActive: false },
    });

    return this.withQrUrl(table, tenant.slug);
  }

  private async createTableWithCode(tenantId: string, label: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.table.create({
          data: {
            tenantId,
            label,
            code: this.generateTableCode(),
          },
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }

        const target = error.meta?.target;
        if (Array.isArray(target) && target.includes('label')) {
          throw new ConflictException('Table label already exists');
        }
      }
    }

    throw new ConflictException('Could not generate a unique table code');
  }

  private async ensureTenantTable(tenantId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        tenantId,
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  private generateTableCode() {
    return `${TABLE_CODE_PREFIX}${randomBytes(TABLE_CODE_BYTES).toString(
      'base64url',
    )}`;
  }

  private normalizeLabel(label: string) {
    const normalizedLabel = label.trim();

    if (!normalizedLabel) {
      throw new BadRequestException('Table label is required');
    }

    return normalizedLabel;
  }

  private withQrUrl(table: Table, tenantSlug: string) {
    return {
      ...table,
      qrUrl: buildTableQrUrl(tenantSlug, table.code),
    };
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
