import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditItemStatus } from '@repo/types';

export class SubmitAuditItemDto {
  @ApiProperty({ description: 'ID of the asset being scanned/checked' })
  @IsString()
  assetId: string;

  @ApiProperty({ enum: AuditItemStatus, description: 'Audit status result for this item' })
  @IsEnum(AuditItemStatus)
  status: AuditItemStatus;

  @ApiPropertyOptional({ description: 'Condition notes for the asset (e.g., Good, Fair, Poor)' })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({ description: 'Additional notes about this audit item' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'ID of the location where the asset was actually found' })
  @IsOptional()
  @IsString()
  foundLocationId?: string;

  @ApiPropertyOptional({ description: 'Path to a photo taken of the asset during audit' })
  @IsOptional()
  @IsString()
  photoPath?: string;
}
