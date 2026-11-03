import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditType } from '@repo/types';

export class CreateAuditPlanDto {
  @ApiProperty({ description: 'Name of the audit plan' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the audit plan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: AuditType, description: 'Type of audit' })
  @IsEnum(AuditType)
  type: AuditType;

  @ApiPropertyOptional({ description: 'Scheduled date for the audit (ISO string)' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiProperty({
    type: [String],
    description: 'List of department/location/category IDs to include in scope',
  })
  @IsArray()
  @IsString({ each: true })
  scopeIds: string[];

  @ApiPropertyOptional({
    description: "Type of scope — 'DEPARTMENT' | 'LOCATION' | 'CATEGORY'",
    enum: ['DEPARTMENT', 'LOCATION', 'CATEGORY'],
  })
  @IsOptional()
  @IsString()
  scopeType?: string;
}
