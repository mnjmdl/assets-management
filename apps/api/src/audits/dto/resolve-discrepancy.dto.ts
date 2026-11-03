import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveDiscrepancyDto {
  @ApiProperty({ description: 'Notes explaining how the discrepancy was resolved' })
  @IsString()
  resolutionNotes: string;
}
