import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAssetStatusDto {
  @ApiProperty({ enum: ['DRAFT','ACTIVE','ASSIGNED','IN_MAINTENANCE','RETIRED','DISPOSED','LOST'] })
  @IsEnum(['DRAFT','ACTIVE','ASSIGNED','IN_MAINTENANCE','RETIRED','DISPOSED','LOST'])
  status: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  reason?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;
}
