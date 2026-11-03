import { IsOptional, IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteMaintainanceDto {
  @ApiPropertyOptional({ description: 'Additional notes about the completed maintenance' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Parts/material cost incurred', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ description: 'Labor cost incurred', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @ApiPropertyOptional({
    description:
      'Override the calculated next due date on the linked schedule (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;
}
