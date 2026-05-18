import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTableDto {
  @ApiPropertyOptional({ example: 'Patio 2' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Set false to disable a table QR without deleting the row.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
