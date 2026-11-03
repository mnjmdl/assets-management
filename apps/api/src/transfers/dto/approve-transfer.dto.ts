import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveTransferDto {
  @ApiPropertyOptional({ description: 'Optional notes for the approval' })
  @IsOptional()
  @IsString()
  notes?: string;
}
