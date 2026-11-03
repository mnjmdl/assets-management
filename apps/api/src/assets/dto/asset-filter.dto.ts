import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssetFilterDto {
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ enum: ['DRAFT','ACTIVE','ASSIGNED','IN_MAINTENANCE','RETIRED','DISPOSED','LOST'] })
  @IsOptional() @IsEnum(['DRAFT','ACTIVE','ASSIGNED','IN_MAINTENANCE','RETIRED','DISPOSED','LOST'])
  status?: string;

  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsDateString() warrantyExpiryBefore?: string;
  @IsOptional() @IsDateString() purchaseDateFrom?: string;
  @IsOptional() @IsDateString() purchaseDateTo?: string;
  @IsOptional() @IsString() sapAssetCode?: string;
}
