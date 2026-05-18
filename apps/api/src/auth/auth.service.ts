import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

const REFRESH_TOKEN_DAYS = 30;
const REFRESH_TOKEN_BYTES = 64;

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
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await this.passwords.verify(
      user.passwordHash,
      dto.password,
    );

    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildLoginResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const refreshToken = await this.findValidRefreshToken(dto.refreshToken);

    const newRefreshToken = this.generateRefreshTokenString();
    const newRefreshTokenHash = await this.hashRefreshToken(newRefreshToken);
    const newRefreshTokenExpiresAt = this.getRefreshTokenExpiry();
    const accessToken = await this.generateAccessToken(refreshToken.user);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: newRefreshTokenHash,
          userId: refreshToken.user.id,
          expiresAt: newRefreshTokenExpiresAt,
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(dto: RefreshTokenDto) {
    const refreshToken = await this.findValidRefreshToken(dto.refreshToken);

    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'Logged out successfully',
    };
  }

  private async buildLoginResponse(user: UserWithMemberships) {
    const refreshToken = this.generateRefreshTokenString();
    const accessToken = await this.generateAccessToken(user);

    await this.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        systemRole: user.systemRole,
      },
      tenants: user.memberships.map((membership) => ({
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
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
      },
      {
        expiresIn: '15m',
      },
    );
  }

  private generateRefreshTokenString() {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = await this.hashRefreshToken(refreshToken);

    return this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });
  }

  private hashRefreshToken(refreshToken: string) {
    return this.passwords.hash(refreshToken);
  }

  private getRefreshTokenExpiry() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    return expiresAt;
  }

  private async findValidRefreshToken(rawRefreshToken: string) {
    const activeRefreshTokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    for (const refreshToken of activeRefreshTokens) {
      const matches = await this.passwords.verify(
        refreshToken.tokenHash,
        rawRefreshToken,
      );

      if (matches) {
        return refreshToken;
      }
    }

    throw new UnauthorizedException('Invalid refresh token');
  }
}

type AccessTokenUser = {
  id: string;
  email: string;
  systemRole: 'SUPER_ADMIN' | 'USER';
};

type UserWithMemberships = AccessTokenUser & {
  name: string | null;
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
