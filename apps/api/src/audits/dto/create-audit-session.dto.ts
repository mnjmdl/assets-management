import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditSessionDto {
  @ApiProperty({ description: 'ID of the audit plan this session belongs to' })
  @IsString()
  planId: string;

  @ApiProperty({ description: 'ID of the auditor assigned to this session' })
  @IsString()
  auditorId: string;

  @ApiPropertyOptional({ description: 'ID of the location being audited' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Additional notes for this session' })
  @IsOptional()
  @IsString()
  notes?: string;
}
