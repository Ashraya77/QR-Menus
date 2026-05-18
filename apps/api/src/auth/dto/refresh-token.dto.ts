import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'opaque-refresh-token-from-login-or-refresh',
    minLength: 32,
  })
  @IsString()
  @MinLength(32)
  refreshToken: string;
}
