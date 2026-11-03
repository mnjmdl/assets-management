import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Machinery & Equipment' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'CAT-3010' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ required: false, example: 'Plant manufacturing heavy machinery' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiProperty({ required: false, example: 'Machinery & Equipment' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, example: 'CAT-3010' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

