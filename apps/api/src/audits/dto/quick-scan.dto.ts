import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuickScanDto {
  @ApiProperty({ description: 'Asset ID' })
  @IsString()
  assetId: string;

  @ApiPropertyOptional({ description: 'Scanned tag code' })
  @IsOptional()
  @IsString()
  scannedCode?: string;

  @ApiProperty({ description: 'Audit status (FOUND, DAMAGED, LOCATION_MISMATCH)' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Verified location ID' })
  @IsOptional()
  @IsString()
  verifiedLocationId?: string;

  @ApiPropertyOptional({ description: 'Target audit session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Target audit plan ID' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'Auditor notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'ISO Timestamp when audited' })
  @IsOptional()
  @IsString()
  auditedAt?: string;
}

