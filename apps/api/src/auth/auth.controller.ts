import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthRateLimitGuard } from '../../common/guards/auth-rate-limit.guard';
import { getEnv } from '../config/load-env';

const REFRESH_COOKIE_NAME = 'qr_refresh_token';
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login platform/admin user',
    description:
      'Sets the refresh token in an httpOnly cookie and returns an access token, user profile, and active tenant memberships.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated successfully.',
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        user: {
          id: 'usr_123',
          name: 'Platform Admin',
          email: 'admin@example.com',
          systemRole: 'USER',
          status: 'ACTIVE',
        },
        tenants: [
          {
            id: 'tenant_123',
            name: 'Cafe Aroma',
            slug: 'cafe-aroma',
            qrUrl: 'http://localhost:3000/t/cafe-aroma',
            role: 'OWNER',
            status: 'ACTIVE',
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return this.withoutRefreshToken(result);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'Reads the httpOnly refresh-token cookie, revokes it, sets a new cookie, and returns a new access token.',
  })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiResponse({
    status: 200,
    description: 'Token rotated successfully.',
    schema: {
      example: {
        accessToken: 'new-jwt-access-token',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token.' })
  @Post('refresh')
  async refresh(
    @Body() dto: Partial<RefreshTokenDto>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawRefreshToken = this.getRefreshToken(request, dto);
    const result = await this.auth.refresh(rawRefreshToken, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });

    this.setRefreshCookie(response, result.refreshToken);
    return this.withoutRefreshToken(result);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout by revoking refresh token' })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiResponse({
    status: 200,
    description: 'Refresh token revoked.',
    schema: { example: { message: 'Logged out successfully' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token.' })
  @Post('logout')
  async logout(
    @Body() dto: Partial<RefreshTokenDto>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawRefreshToken = this.getRefreshToken(request, dto, false);
    const result = await this.auth.logout(rawRefreshToken);
    this.clearRefreshCookie(response);
    return result;
  }

  private getRefreshToken(
    request: Request,
    dto: Partial<RefreshTokenDto>,
    required = true,
  ) {
    const fromCookie = this.parseCookies(request.headers.cookie ?? '')[
      REFRESH_COOKIE_NAME
    ];
    const token = fromCookie ?? dto.refreshToken;

    if (!token && required) {
      throw new UnauthorizedException('Refresh token cookie is required');
    }

    return token;
  }

  private parseCookies(header: string) {
    return header.split(';').reduce<Record<string, string>>((cookies, part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex === -1) return cookies;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (key) {
        cookies[key] = decodeURIComponent(value);
      }

      return cookies;
    }, {});
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: getEnv('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      domain: process.env.COOKIE_DOMAIN || undefined,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: getEnv('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
      domain: process.env.COOKIE_DOMAIN || undefined,
    });
  }

  private withoutRefreshToken<T extends { refreshToken: string }>(result: T) {
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }
}
