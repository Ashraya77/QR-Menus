import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateTableDto {
  @ApiProperty({
    example: 'Table 5',
    description:
      'Human-readable table/location name. The public QR code is generated separately.',
  })
  @IsString()
  @MinLength(1)
  label: string;
}
