import { IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Key-value map of system setting parameters',
    example: { company_name: 'CMBD Enterprise', currency: 'USD ($)' },
  })
  @IsObject()
  settings: Record<string, string>;
}

