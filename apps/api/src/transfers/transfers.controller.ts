import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransferStatus } from '@repo/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApproveTransferDto } from './dto/approve-transfer.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { RejectTransferDto } from './dto/reject-transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('Transfers')
@Controller({ path: 'transfers', version: '1' })
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary statistics of transfer requests' })
  getStats() {
    return this.transfersService.getStats();
  }

  @Get('departments')
  @ApiOperation({ summary: 'List all departments for transfer selection' })
  getDepartments() {
    return this.transfersService.getDepartments();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new asset transfer request' })
  create(
    @Body() createTransferDto: CreateTransferDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.transfersService.create(createTransferDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all transfer requests with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'assetId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: TransferStatus })
  @ApiQuery({ name: 'fromDeptId', required: false, type: String })
  @ApiQuery({ name: 'toDeptId', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('assetId') assetId?: string,
    @Query('status') status?: TransferStatus,
    @Query('fromDeptId') fromDeptId?: string,
    @Query('toDeptId') toDeptId?: string,
  ) {
    return this.transfersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      assetId,
      status,
      fromDeptId,
      toDeptId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transfer request by ID' })
  findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending transfer request' })
  approve(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
    @Body() approveTransferDto?: ApproveTransferDto,
  ) {
    return this.transfersService.approve(id, userId, approveTransferDto);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending transfer request' })
  reject(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
    @Body() rejectTransferDto?: RejectTransferDto,
  ) {
    return this.transfersService.reject(id, userId, rejectTransferDto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark an approved transfer as completed' })
  complete(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.transfersService.complete(id, userId);
  }
}
