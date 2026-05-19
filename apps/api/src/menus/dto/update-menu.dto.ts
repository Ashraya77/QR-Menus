import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MenuCategoryDto } from './menu-category.dto';

export class UpdateMenuDto {
  @ApiPropertyOptional({ example: 'Dinner Menu' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [MenuCategoryDto],
    description:
      'When provided, replaces the menu categories and items with this list.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuCategoryDto)
  categories?: MenuCategoryDto[];
}
