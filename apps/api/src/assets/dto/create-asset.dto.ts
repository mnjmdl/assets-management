import {
  IsString, IsOptional, IsEnum, IsNumber, IsDateString,
  IsUUID, MinLength, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty() @IsString() @MinLength(2)
  name: string;

  @ApiProperty({ description: 'Unique SAP asset code' })
  @IsString()
  @MinLength(1)
  sapAssetCode: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string;

  @ApiProperty() @IsString()
  categoryId: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  serialNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  model?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  manufacturer?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: ['GOOD', 'FAIR', 'POOR'] })
  @IsOptional() @IsEnum(['GOOD', 'FAIR', 'POOR'])
  condition?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  purchaseCost?: number;

  @ApiPropertyOptional({ enum: ['STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE'] })
  @IsOptional() @IsEnum(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE'])
  depreciationMethod?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  depreciationRate?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber()
  usefulLifeYears?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  vendorId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  warrantyExpiry?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  warrantyDetails?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  locationId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  departmentId?: string;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;
}
