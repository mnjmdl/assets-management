import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RejectTransferDto {
  @ApiProperty({ description: 'The reason for rejecting the transfer request' })
  @IsString()
  rejectionReason: string;
}
