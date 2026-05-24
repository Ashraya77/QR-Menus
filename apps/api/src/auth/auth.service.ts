import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { LoginDto } from './dto/login.dto';
import { buildTenantQrUrl } from '../../common/utils/qr-url';

const REFRESH_TOKEN_SECRET_BYTES = 64;
const REFRESH_TOKEN_ID_BYTES = 18;
const ACTIVE = 'ACTIVE';
const TOKEN_REVOKED_REASON = {
  LOGOUT: 'LOGOUT',
  ROTATED: 'ROTATED',
  REUSED: 'REUSED',
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: {
            status: ACTIVE,
            tenant: {
              status: ACTIVE,
            },
          },
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      await this.audit('auth.login_failed', {
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== ACTIVE) {
      await this.audit('auth.login_failed', {
        actorUserId: user.id,
        metadata: { email, reason: 'USER_DISABLED' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await this.passwords.verify(
      user.passwordHash,
      dto.password,
    );

    if (!validPassword) {
      await this.audit('auth.login_failed', {
        actorUserId: user.id,
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.audit('auth.login_success', { actorUserId: user.id });

    return this.buildLoginResponse(user);
  }

  async refresh(rawRefreshToken: string, metadata: RequestMetadata = {}) {
    const refreshToken =
      await this.findRefreshTokenForRotation(rawRefreshToken);

    const newRefreshToken = await this.prepareRefreshToken(
      refreshToken.user.id,
      {
        ...metadata,
        familyId: refreshToken.id,
      },
    );
    const accessToken = await this.generateAccessToken(refreshToken.user);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: newRefreshToken.record,
      }),
      this.prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: {
          revokedAt: now,
          revokedReason: TOKEN_REVOKED_REASON.ROTATED,
          replacedByTokenId: newRefreshToken.record.id,
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken: newRefreshToken.rawToken,
    };
  }

  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const refreshToken =
        await this.findRefreshTokenForLogout(rawRefreshToken);

      if (refreshToken && !refreshToken.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: refreshToken.id },
          data: {
            revokedAt: new Date(),
            revokedReason: TOKEN_REVOKED_REASON.LOGOUT,
          },
        });
        await this.audit('auth.logout', { actorUserId: refreshToken.userId });
      }
    }

    return {
      message: 'Logged out successfully',
    };
  }

  private async buildLoginResponse(user: UserWithMemberships) {
    const refreshToken = await this.prepareRefreshToken(user.id);
    const accessToken = await this.generateAccessToken(user);

    await this.prisma.refreshToken.create({
      data: refreshToken.record,
    });

    return {
      accessToken,
      refreshToken: refreshToken.rawToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        systemRole: user.systemRole,
        status: user.status,
      },
      tenants: user.memberships.map((membership) => ({
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
        qrUrl: buildTenantQrUrl(membership.tenant.slug),
        role: membership.role,
        status: membership.status,
      })),
    };
  }

  private generateAccessToken(user: AccessTokenUser) {
    return this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        systemRole: user.systemRole,
        type: 'access',
      },
      {
        expiresIn: '15m',
      },
    );
  }

  private async prepareRefreshToken(
    userId: string,
    metadata: RequestMetadata = {},
  ) {
    const tokenId = this.generateRefreshTokenId();
    const secret = this.generateRefreshTokenSecret();

    return {
      rawToken: `${tokenId}.${secret}`,
      record: {
        id: tokenId,
        tokenHash: await this.hashRefreshTokenSecret(secret),
        userId,
        expiresAt: this.getRefreshTokenExpiry(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        familyId: metadata.familyId ?? tokenId,
      },
    };
  }

  private generateRefreshTokenId() {
    return `rt_${randomBytes(REFRESH_TOKEN_ID_BYTES).toString('base64url')}`;
  }

  private generateRefreshTokenSecret() {
    return randomBytes(REFRESH_TOKEN_SECRET_BYTES).toString('base64url');
  }

  private hashRefreshTokenSecret(secret: string) {
    return this.passwords.hash(secret);
  }

  private getRefreshTokenExpiry() {
    const expiresAt = new Date();
    const refreshTokenDays = Number(process.env.REFRESH_TOKEN_DAYS ?? '30');
    expiresAt.setDate(expiresAt.getDate() + refreshTokenDays);

    return expiresAt;
  }

  private parseRefreshToken(rawRefreshToken: string) {
    const [tokenId, secret, extra] = rawRefreshToken.split('.');

    if (!tokenId || !secret || extra !== undefined) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { tokenId, secret };
  }
  
  private async findRefreshTokenForRotation(rawRefreshToken: string) {
    const { tokenId, secret } = this.parseRefreshToken(rawRefreshToken);
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await this.passwords.verify(refreshToken.tokenHash, secret);

    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.revokedAt) {
      await this.revokeUserRefreshTokensForReuse(refreshToken.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      refreshToken.expiresAt <= new Date() ||
      refreshToken.user.status !== ACTIVE
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return refreshToken;
  }

  private async findRefreshTokenForLogout(rawRefreshToken: string) {
    const { tokenId, secret } = this.parseRefreshToken(rawRefreshToken);
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await this.passwords.verify(refreshToken.tokenHash, secret);

    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return refreshToken;
  }

  private async revokeUserRefreshTokensForReuse(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: TOKEN_REVOKED_REASON.REUSED,
      },
    });

    await this.audit('auth.refresh_token_reused', { actorUserId: userId });
  }

  private async audit(action: string, data: AuditData = {}) {
    try {
      const auditLog = (this.prisma as unknown as AuditLogWriter).auditLog;

      await auditLog.create({
        data: {
          action,
          actorUserId: data.actorUserId,
          tenantId: data.tenantId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch {
      // Authentication must not fail because the best-effort audit sink is down.
    }
  }
}

type AccessTokenUser = {
  id: string;
  email: string;
  systemRole: 'SUPER_ADMIN' | 'USER';
  status?: 'ACTIVE' | 'DISABLED';
};

type UserWithMemberships = AccessTokenUser & {
  name: string | null;
  status: 'ACTIVE' | 'DISABLED';
  memberships: {
    role: 'OWNER' | 'ADMIN' | 'STAFF';
    status: 'INVITED' | 'ACTIVE' | 'DISABLED';
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
};

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
  familyId?: string;
};

type AuditData = {
  actorUserId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

type AuditLogWriter = {
  auditLog: {
    create(args: {
      data: {
        action: string;
        actorUserId?: string;
        tenantId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Prisma.InputJsonValue;
      };
    }): Promise<unknown>;
  };
};
