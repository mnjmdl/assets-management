import { IsEmail, IsEnum, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@repo/types';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'EMP-001' })
  @IsOptional() @IsString()
  employeeId?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString() @MinLength(2)
  name: string;

  @ApiProperty({ example: 'john@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Must contain uppercase letter' })
  @Matches(/[0-9]/, { message: 'Must contain a number' })
  password: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional() @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  departmentId?: string;
}
