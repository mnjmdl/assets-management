import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveDiscrepancyDto {
  @ApiProperty({ description: 'Notes explaining how the discrepancy was resolved' })
  @IsString()
  resolutionNotes: string;

  @ApiPropertyOptional({ description: 'Optional action code: MARK_LOST, RESOLVED_FOUND, RELOCATED' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Whether to update master Asset.status to LOST upon manager approval' })
  @IsOptional()
  @IsBoolean()
  markAssetAsLost?: boolean;
}
