import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssetCondition } from './create-assignment.dto';

export class ReturnAssetDto {
  @ApiPropertyOptional({ enum: AssetCondition, description: 'Condition of asset upon return' })
  @IsOptional()
  @IsEnum(AssetCondition)
  conditionIn?: AssetCondition;

  @ApiPropertyOptional({ description: 'Additional notes for the return' })
  @IsOptional()
  @IsString()
  notes?: string;
}
