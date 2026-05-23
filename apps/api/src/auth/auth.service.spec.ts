import { UnauthorizedException } from '@nestjs/common';
import {
  MemberStatus,
  RefreshTokenRevokedReason,
  SystemRole,
  TenantStatus,
  UserStatus,
} from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const jwt = {
    signAsync: jest.fn(),
  };
  const passwords = {
    hash: jest.fn(),
    verify: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REFRESH_TOKEN_DAYS = '30';
    service = new AuthService(
      prisma as never,
      jwt as never,
      passwords as never,
    );
  });

  it('filters login memberships to active memberships on active tenants', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: 'Owner',
      email: 'owner@example.com',
      passwordHash: 'hash',
      systemRole: SystemRole.USER,
      status: UserStatus.ACTIVE,
      memberships: [],
    });
    passwords.verify.mockResolvedValue(true);
    passwords.hash.mockResolvedValue('refresh-hash');
    jwt.signAsync.mockResolvedValue('access-token');
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    await service.login({
      email: ' OWNER@example.com ',
      password: 'password123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'owner@example.com' },
        include: {
          memberships: {
            where: {
              status: MemberStatus.ACTIVE,
              tenant: {
                status: TenantStatus.ACTIVE,
              },
            },
            include: {
              tenant: true,
            },
          },
        },
      }),
    );
  });

  it('rotates refresh tokens by id lookup without scanning active tokens', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_old',
      tokenHash: 'old-hash',
      userId: 'user_1',
      user: {
        id: 'user_1',
        email: 'owner@example.com',
        systemRole: SystemRole.USER,
        status: UserStatus.ACTIVE,
      },
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      familyId: 'family_1',
    });
    passwords.verify.mockResolvedValue(true);
    passwords.hash.mockResolvedValue('new-secret-hash');
    jwt.signAsync.mockResolvedValue('new-access-token');
    prisma.refreshToken.create.mockReturnValue(Promise.resolve({}));
    prisma.refreshToken.update.mockReturnValue(Promise.resolve({}));
    prisma.$transaction.mockResolvedValue([]);

    const result = await service.refresh('rt_old.secret');
    const createdToken = prisma.refreshToken.create.mock.calls[0][0].data;

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toMatch(/^rt_[^.]+\.[^.]+$/);
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { id: 'rt_old' },
      include: { user: true },
    });
    expect(prisma.refreshToken.findMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt_old' },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RefreshTokenRevokedReason.ROTATED,
        replacedByTokenId: createdToken.id,
      },
    });
  });

  it('revokes active user sessions when a revoked refresh token is reused', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_old',
      tokenHash: 'old-hash',
      userId: 'user_1',
      user: {
        id: 'user_1',
        email: 'owner@example.com',
        systemRole: SystemRole.USER,
        status: UserStatus.ACTIVE,
      },
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });
    passwords.verify.mockResolvedValue(true);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditLog.create.mockResolvedValue({});

    await expect(service.refresh('rt_old.secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RefreshTokenRevokedReason.REUSED,
      },
    });
    expect(prisma.refreshToken.findMany).not.toHaveBeenCalled();
  });
});
