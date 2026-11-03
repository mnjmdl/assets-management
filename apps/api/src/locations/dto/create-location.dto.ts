import { IsString, IsOptional, MinLength, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@repo/types';

export class CreateLocationDto {
  @ApiProperty({ example: 'Line 01 - Packaging' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'LOC-CMP-U1-BLK-L01' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  code: string;

  @ApiProperty({
    enum: LocationType,
    example: LocationType.LINE,
    description: 'Level in hierarchy: COMPANY > UNIT > BLOCK > LINE',
  })
  @IsEnum(LocationType, {
    message: 'type must be one of: COMPANY, UNIT, BLOCK, LINE',
  })
  type: LocationType;

  @ApiPropertyOptional({ example: 'Main Packaging Building' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: 'Ground Floor' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: 'Bay 3' })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional({ example: 'Automated packaging and carton assembly line' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent location ID: UNIT belongs to COMPANY, BLOCK belongs to UNIT, LINE belongs to BLOCK',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}
