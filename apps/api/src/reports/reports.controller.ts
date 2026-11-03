import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('assets')
  @ApiOperation({ summary: 'Get asset summary report as JSON' })
  async getAssetSummaryReport(
    @Query('departmentId') departmentId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
  ) {
    return this.reportsService.assetSummaryReport({
      departmentId,
      categoryId,
      status,
    });
  }

  @Get('assets/export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="asset-summary.xlsx"')
  @ApiOperation({ summary: 'Export asset summary report as Excel file' })
  async exportAssetSummaryReport(
    @Res() res: any,
    @Query('departmentId') departmentId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.reportsService.generateAssetSummaryExcel({
      departmentId,
      categoryId,
      status,
    });
    res.end(buffer);
  }

  @Get('depreciation')
  @ApiOperation({ summary: 'Get depreciation report as JSON' })
  async getDepreciationReport() {
    return this.reportsService.depreciationReport();
  }

  @Get('depreciation/export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="depreciation-report.xlsx"',
  )
  @ApiOperation({ summary: 'Export depreciation report as Excel file' })
  async exportDepreciationReport(@Res() res: any) {
    const buffer = await this.reportsService.generateDepreciationExcel();
    res.end(buffer);
  }

  @Get('audits')
  @ApiOperation({ summary: 'Get consolidated audit status report as JSON' })
  async getAuditStatusReport(
    @Query('planId') planId?: string,
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.reportsService.auditStatusReport({
      planId,
      status,
      locationId,
    });
  }

  @Get('audits/export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="audit-status-report.xlsx"')
  @ApiOperation({ summary: 'Export audit status report as Excel file' })
  async exportAuditStatusReport(
    @Res() res: any,
    @Query('planId') planId?: string,
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
  ) {
    const buffer = await this.reportsService.generateAuditStatusExcel({
      planId,
      status,
      locationId,
    });
    res.end(buffer);
  }

  @Get('audits/:planId')
  @ApiOperation({ summary: 'Get audit report for a specific audit plan' })
  async getAuditReport(@Param('planId') planId: string) {
    return this.reportsService.auditReport(planId);
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Get maintenance cost report as JSON' })
  async getMaintenanceCostReport(
    @Query('assetId') assetId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.maintenanceCostReport({
      assetId,
      vendorId,
      from,
      to,
    });
  }
}
