import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetDto } from './create-asset.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @ApiPropertyOptional({
    description: 'Operational status: ACTIVE, IN_MAINTENANCE, DISPOSED, RETIRED, DRAFT',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
