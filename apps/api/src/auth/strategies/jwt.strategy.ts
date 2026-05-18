import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type JwtUser = {
  id: string;
  email: string;
  systemRole: 'SUPER_ADMIN' | 'USER';
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    systemRole: 'SUPER_ADMIN' | 'USER';
  }): JwtUser {
    return {
      id: payload.sub,
      email: payload.email,
      systemRole: payload.systemRole,
    };
  }
}
