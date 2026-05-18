import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberStatus, TenantRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTenantMemberDto {
  @ApiProperty({ example: 'Store Manager' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'manager@cafearoma.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'change-this-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: TenantRole, example: TenantRole.ADMIN })
  @IsEnum(TenantRole)
  role: TenantRole;

  @ApiPropertyOptional({ enum: MemberStatus, example: MemberStatus.ACTIVE })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;
}
