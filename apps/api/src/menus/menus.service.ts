import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import { buildTableQrUrl, buildTenantQrUrl } from '../../common/utils/qr-url';
import { PrismaService } from '../database/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { MenuCategoryDto, MenuItemDto } from './dto/menu-category.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly menuInclude = {
    categories: {
      orderBy: { position: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    },
  } satisfies Prisma.MenuInclude;

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
      include: this.menuInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMenu(tenantId: string, dto: CreateMenuDto) {
    try {
      return await this.prisma.menu.create({
        data: {
          tenantId,
          name: this.normalizeName(dto.name, 'Menu name is required'),
          isActive: dto.isActive ?? true,
          ...(dto.categories
            ? { categories: { create: this.toCategoryCreates(dto.categories) } }
            : {}),
        },
        include: this.menuInclude,
      });
    } catch (error) {
      this.handleUniqueConstraint(error);
    }
  }

  async updateMenu(tenantId: string, menuId: string, dto: UpdateMenuDto) {
    await this.ensureTenantMenu(tenantId, menuId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.categories !== undefined) {
          await tx.category.deleteMany({
            where: { menuId },
          });
        }

        return tx.menu.update({
          where: { id: menuId },
          data: {
            ...(dto.name !== undefined
              ? { name: this.normalizeName(dto.name, 'Menu name is required') }
              : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            ...(dto.categories !== undefined
              ? {
                  categories: {
                    create: this.toCategoryCreates(dto.categories),
                  },
                }
              : {}),
          },
          include: this.menuInclude,
        });
      });
    } catch (error) {
      this.handleUniqueConstraint(error);
    }
  }

  async deleteMenu(tenantId: string, menuId: string) {
    await this.ensureTenantMenu(tenantId, menuId);

    return this.prisma.menu.delete({
      where: { id: menuId },
      include: this.menuInclude,
    });
  }

  private async ensureTenantMenu(tenantId: string, menuId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: {
        id: menuId,
        tenantId,
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return menu;
  }

  private toCategoryCreates(categories: MenuCategoryDto[]) {
    return categories.map((category) => ({
      name: this.normalizeName(category.name, 'Category name is required'),
      description: this.normalizeOptionalString(category.description),
      position: category.position ?? 0,
      isActive: category.isActive ?? true,
      ...(category.items
        ? { items: { create: this.toItemCreates(category.items) } }
        : {}),
    }));
  }

  private toItemCreates(items: MenuItemDto[]) {
    return items.map((item) => ({
      name: this.normalizeName(item.name, 'Item name is required'),
      description: this.normalizeOptionalString(item.description),
      price: new Prisma.Decimal(item.price),
      currency:
        this.normalizeOptionalString(item.currency)?.toUpperCase() ?? 'USD',
      imageUrl: this.normalizeOptionalString(item.imageUrl),
      isAvailable: item.isAvailable ?? true,
      position: item.position ?? 0,
    }));
  }

  private normalizeName(value: string, message: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private normalizeOptionalString(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private handleUniqueConstraint(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;

      if (Array.isArray(target) && target.includes('menuId')) {
        throw new ConflictException('Category name already exists in menu');
      }

      if (Array.isArray(target) && target.includes('categoryId')) {
        throw new ConflictException('Item name already exists in category');
      }

      throw new ConflictException('Menu name already exists');
    }

    throw error;
  }
}
