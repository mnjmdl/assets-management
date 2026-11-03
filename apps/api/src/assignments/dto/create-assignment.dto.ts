import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// NOTE: At least one of assignedToUserId or assignedToDeptId should be provided.
// Business-level validation should be performed in the service layer.
export enum AssetCondition {
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

export class CreateAssignmentDto {
  @ApiProperty({ description: 'ID of the asset to assign' })
  @IsString()
  assetId: string;

  @ApiPropertyOptional({ description: 'User to assign the asset to' })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional({ description: 'Department to assign the asset to' })
  @IsOptional()
  @IsString()
  assignedToDeptId?: string;

  @ApiPropertyOptional({ description: 'Location ID for the assignment' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Expected return date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expectedReturnAt?: string;

  @ApiPropertyOptional({ enum: AssetCondition, description: 'Condition of asset at time of assignment' })
  @IsOptional()
  @IsEnum(AssetCondition)
  conditionOut?: AssetCondition;

  @ApiPropertyOptional({ description: 'Additional notes for this assignment' })
  @IsOptional()
  @IsString()
  notes?: string;
}
