import { MemberStatus, TenantRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTenantMemberDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(TenantRole)
  role: TenantRole;

  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;
}
