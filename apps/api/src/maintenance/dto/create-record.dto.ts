import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceType } from '@repo/types';

export class CreateRecordDto {
  @ApiProperty({ description: 'Asset ID for this maintenance record' })
  @IsString()
  assetId: string;

  @ApiPropertyOptional({ description: 'Optional schedule ID this record is linked to' })
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @ApiProperty({ enum: MaintenanceType, description: 'Type of maintenance' })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiPropertyOptional({ description: 'Work order title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Description of the maintenance work' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID of the user who will perform the maintenance' })
  @IsOptional()
  @IsString()
  performedById?: string;

  @ApiPropertyOptional({ description: 'ID of the vendor performing the maintenance' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiProperty({ description: 'Scheduled date for the maintenance (ISO string)' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ description: 'Parts/material cost', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ description: 'Labor cost', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
