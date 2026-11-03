import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ description: 'The ID of the asset to transfer' })
  @IsString()
  assetId: string;

  @ApiPropertyOptional({ description: 'The ID of the destination department' })
  @IsOptional()
  @IsString()
  toDeptId?: string;

  @ApiPropertyOptional({ description: 'The ID of the destination location' })
  @IsOptional()
  @IsString()
  toLocationId?: string;

  @ApiPropertyOptional({ description: 'Reason for the transfer request' })
  @IsOptional()
  @IsString()
  reason?: string;
}
