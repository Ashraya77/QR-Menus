import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'rt_tokenId.randomBase64UrlSecret',
    minLength: 32,
    description:
      'Fallback for non-browser clients. Browser clients should use the httpOnly refresh cookie.',
  })
  @IsString()
  @MinLength(32)
  refreshToken: string;
}
