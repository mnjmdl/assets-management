import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Role } from '@repo/types';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MaintenanceService } from './maintenance.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateRecordDto } from './dto/create-record.dto';
import { CompleteMaintainanceDto } from './dto/complete-maintenance.dto';

@ApiTags('Maintenance')
@Controller({ path: 'maintenance', version: '1' })
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get maintenance KPIs and overview stats' })
  getStats() {
    return this.maintenanceService.getStats();
  }

  // ─── Schedules ────────────────────────────────────────────────────────────

  @Post('schedules')
  @ApiOperation({ summary: 'Create a new maintenance schedule for an asset' })
  createSchedule(@Body() dto: CreateScheduleDto) {
    return this.maintenanceService.createSchedule(dto);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'List all maintenance schedules (paginated, filterable)' })
  @ApiQuery({ name: 'assetId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAllSchedules(
    @Query('assetId') assetId?: string,
    @Query('type') type?: any,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.maintenanceService.findAllSchedules({
      assetId,
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── Records ──────────────────────────────────────────────────────────────

  @Post('records')
  @ApiOperation({ summary: 'Create a new maintenance record for an asset' })
  createRecord(@Body() dto: CreateRecordDto) {
    return this.maintenanceService.createRecord(dto);
  }

  @Get('records')
  @ApiOperation({ summary: 'List all maintenance records (paginated, filterable)' })
  @ApiQuery({ name: 'assetId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAllRecords(
    @Query('assetId') assetId?: string,
    @Query('status') status?: any,
    @Query('type') type?: any,
    @Query('vendorId') vendorId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.maintenanceService.findAllRecords({
      assetId,
      status,
      type,
      vendorId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('records/:id')
  @ApiOperation({ summary: 'Get a single maintenance record by ID' })
  findOneRecord(@Param('id') id: string) {
    return this.maintenanceService.findOneRecord(id);
  }

  @Patch('records/:id/start')
  @ApiOperation({ summary: 'Start a scheduled maintenance record' })
  startMaintenance(@Param('id') id: string) {
    return this.maintenanceService.startMaintenance(id);
  }

  @Patch('records/:id/complete')
  @ApiOperation({ summary: 'Complete an in-progress maintenance record' })
  completeMaintenance(
    @Param('id') id: string,
    @Body() dto: CompleteMaintainanceDto,
  ) {
    return this.maintenanceService.completeMaintenance(id, dto);
  }

  @Patch('records/:id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled or in-progress maintenance record' })
  cancelMaintenance(@Param('id') id: string) {
    return this.maintenanceService.cancelMaintenance(id);
  }
}
