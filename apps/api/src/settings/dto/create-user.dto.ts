import { IsString, IsNotEmpty, IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john.doe@assets.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'AUDITOR', enum: ['SUPER_ADMIN', 'ASSET_MANAGER', 'AUDITOR', 'TECHNICIAN', 'EMPLOYEE'] })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ required: false, example: '+880 1700-111222' })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, minLength: 6 })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  isActive?: boolean;
}

