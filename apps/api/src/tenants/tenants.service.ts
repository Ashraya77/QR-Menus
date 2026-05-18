import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberStatus,
  Prisma,
  SystemRole,
  TenantRole,
  TenantStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { JwtUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async createTenant(dto: CreateTenantDto, currentUser: JwtUser) {
    if (currentUser.systemRole !== SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can create tenants');
    }

    const slug = this.toSlug(dto.slug ?? dto.name);
    const ownerEmail = dto.ownerEmail.toLowerCase().trim();
    const passwordHash = await this.passwords.hash(dto.ownerPassword);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name,
            slug,
            logoUrl: dto.logoUrl,
            status: TenantStatus.ACTIVE,
            createdById: currentUser.id,
          },
        });

        const owner = await tx.user.create({
          data: {
            name: dto.ownerName,
            email: ownerEmail,
            passwordHash,
            systemRole: SystemRole.USER,
            memberships: {
              create: {
                tenantId: tenant.id,
                role: TenantRole.OWNER,
                status: MemberStatus.ACTIVE,
              },
            },
          },
        });

        return { tenant, owner };
      });

      return {
        tenant: result.tenant,
        owner: this.publicUser(result.owner),
      };
    } catch (error) {
      this.handleUniqueConstraint(error);
    }
  }

  async createMember(
    tenantId: string,
    dto: CreateTenantMemberDto,
    currentUser: JwtUser,
  ) {
    if (dto.role === TenantRole.OWNER) {
      throw new BadRequestException('OWNER accounts are created with tenants');
    }

    if (![TenantRole.ADMIN, TenantRole.STAFF].includes(dto.role)) {
      throw new BadRequestException('Only ADMIN or STAFF can be created');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException('Tenant is not active');
    }

    if (currentUser.systemRole !== SystemRole.SUPER_ADMIN) {
      const membership = await this.prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: currentUser.id,
            tenantId,
          },
        },
      });

      if (
        !membership ||
        membership.status !== MemberStatus.ACTIVE ||
        membership.role !== TenantRole.OWNER
      ) {
        throw new ForbiddenException(
          'Only tenant OWNER can create members for this tenant',
        );
      }
    }

    const email = dto.email.toLowerCase().trim();
    const passwordHash = await this.passwords.hash(dto.password);
    const status = dto.status ?? MemberStatus.ACTIVE;

    if (status === MemberStatus.DISABLED) {
      throw new BadRequestException(
        'New members cannot be created as DISABLED',
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { email },
          update: {
            name: dto.name,
          },
          create: {
            name: dto.name,
            email,
            passwordHash,
            systemRole: SystemRole.USER,
          },
        });

        const membership = await tx.tenantMember.create({
          data: {
            userId: user.id,
            tenantId,
            role: dto.role,
            status,
          },
        });

        return { user, membership };
      });

      return {
        user: this.publicUser(result.user),
        membership: result.membership,
      };
    } catch (error) {
      this.handleUniqueConstraint(error);
    }
  }

  private toSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private publicUser(user: {
    id: string;
    name: string | null;
    email: string;
    systemRole: SystemRole;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
    };
  }

  private handleUniqueConstraint(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Tenant slug, user email, or membership already exists',
      );
    }

    throw error;
  }
}
