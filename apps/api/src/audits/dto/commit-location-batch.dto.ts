import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScannedBatchItemDto {
  @ApiProperty({ description: 'Asset ID' })
  @IsString()
  assetId: string;

  @ApiPropertyOptional({ description: 'Asset physical condition (GOOD, FAIR, DAMAGED)' })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CommitLocationBatchDto {
  @ApiProperty({ description: 'Location ID where assets were scanned' })
  @IsString()
  locationId: string;

  @ApiPropertyOptional({ description: 'Auditor ID' })
  @IsOptional()
  @IsString()
  auditorId?: string;

  @ApiProperty({ type: [ScannedBatchItemDto], description: 'List of scanned assets' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScannedBatchItemDto)
  items: ScannedBatchItemDto[];
}

