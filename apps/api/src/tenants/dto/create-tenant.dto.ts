import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Cafe Aroma' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'cafe-aroma' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/cafe-aroma/logo.png',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ example: 'Asha Lama' })
  @IsString()
  ownerName: string;

  @ApiProperty({ example: 'owner@cafearoma.test' })
  @IsEmail()
  ownerEmail: string;

  @ApiProperty({ example: 'change-this-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  ownerPassword: string;
}
