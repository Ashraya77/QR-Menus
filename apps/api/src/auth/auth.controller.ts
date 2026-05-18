import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @ApiOperation({
    summary: 'Login platform/admin user',
    description:
      'Returns an access token, refresh token, user profile, and tenant memberships.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Authenticated successfully.',
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        refreshToken: 'opaque-refresh-token',
        user: {
          id: 'usr_123',
          name: 'Platform Admin',
          email: 'admin@example.com',
          systemRole: 'USER',
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
  login(@Body() dto: LoginDto) {
    // Refresh tokens are returned in JSON for now. This is the boundary where
    // httpOnly secure cookie support can be added later.
    return this.auth.login(dto);
  }

  @Public()
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'Accepts an opaque refresh token, revokes it, and returns a new access/refresh token pair.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 201,
    description: 'Token rotated successfully.',
    schema: {
      example: {
        accessToken: 'new-jwt-access-token',
        refreshToken: 'new-opaque-refresh-token',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token.' })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Logout by revoking refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 201,
    description: 'Refresh token revoked.',
    schema: { example: { message: 'Logged out successfully' } },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token.' })
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto);
  }
}
