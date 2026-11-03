import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateVendorDto {
  @ApiProperty({ description: 'Vendor name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Unique vendor code' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'Primary contact person name' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Vendor contact email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Vendor contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Vendor physical address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Vendor website URL' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Service types offered (comma-separated)' })
  @IsOptional()
  @IsString()
  serviceTypes?: string;

  @ApiPropertyOptional({ description: 'Additional notes about the vendor' })
  @IsOptional()
  @IsString()
  notes?: string;
}
