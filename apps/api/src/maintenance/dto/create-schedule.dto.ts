import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceType } from '@repo/types';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Asset ID to schedule maintenance for' })
  @IsString()
  assetId: string;

  @ApiProperty({ enum: MaintenanceType, description: 'Type of maintenance' })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiPropertyOptional({ description: 'Schedule title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Frequency in days between maintenance', minimum: 1 })
  @IsInt()
  @Min(1)
  frequencyDays: number;

  @ApiPropertyOptional({ description: 'Description of the maintenance schedule' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Override the calculated next due date (ISO string)' })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;
}
