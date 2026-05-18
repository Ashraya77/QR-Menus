import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { buildTableQrUrl, buildTenantQrUrl } from '../../common/utils/qr-url';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicMenu(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        menus: {
          where: { isActive: true },
          include: {
            categories: {
              where: { isActive: true },
              orderBy: { position: 'asc' },
              include: {
                items: {
                  where: { isAvailable: true },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        qrUrl: buildTenantQrUrl(tenant.slug),
      },
      menus: tenant.menus,
    };
  }

  async getPublicTableMenu(tenantSlug: string, tableCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        status: true,
      },
    });

    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new NotFoundException('Menu not found');
    }

    const table = await this.prisma.table.findUnique({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: tableCode,
        },
      },
      select: {
        id: true,
        label: true,
        code: true,
        isActive: true,
      },
    });

    if (!table || !table.isActive) {
      throw new NotFoundException('Menu not found');
    }

    const menu = await this.prisma.menu.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        categories: {
          where: { isActive: true },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            position: true,
            items: {
              where: { isAvailable: true },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                imageUrl: true,
                isAvailable: true,
                position: true,
              },
            },
          },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        qrUrl: buildTenantQrUrl(tenant.slug),
      },
      table: {
        id: table.id,
        label: table.label,
        code: table.code,
        qrUrl: buildTableQrUrl(tenant.slug, table.code),
      },
      menu: {
        ...menu,
        categories: menu.categories.map((category) => ({
          ...category,
          items: category.items.map((item) => ({
            ...item,
            price: item.price.toString(),
          })),
        })),
      },
    };
  }

  getTenantMenus(tenantId: string) {
    return this.prisma.menu.findMany({
      where: { tenantId },
      include: {
        categories: {
          orderBy: { position: 'asc' },
          include: {
            items: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
