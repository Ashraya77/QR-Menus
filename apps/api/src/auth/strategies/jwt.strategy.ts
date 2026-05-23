import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { SystemRole, UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

export type JwtUser = {
  id: string;
  email: string;
  systemRole: SystemRole;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    systemRole: SystemRole;
    type?: string;
  }): Promise<JwtUser> {
    if (
      !payload?.sub ||
      !payload.email ||
      !Object.values(SystemRole).includes(payload.systemRole) ||
      payload.type !== 'access'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        systemRole: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      id: user.id,
      email: user.email,
      systemRole: user.systemRole,
    };
  }
}
