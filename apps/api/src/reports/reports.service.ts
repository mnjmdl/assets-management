import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async assetSummaryReport(filter: {
    departmentId?: string;
    categoryId?: string;
    status?: string;
  }) {
    const where: Record<string, any> = { isActive: true };
    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.status) where.status = filter.status;

    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    return assets.map((asset) => ({
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      status: asset.status,
      category: asset.category?.name ?? null,
      department: asset.department?.name ?? null,
      location: asset.location?.name ?? null,
      purchaseCost: asset.purchaseCost ? Number(asset.purchaseCost) : null,
      currentValue: asset.currentValue ? Number(asset.currentValue) : null,
      depreciationMethod: asset.depreciationMethod,
      purchaseDate: asset.purchaseDate,
      warrantyExpiry: asset.warrantyExpiry,
    }));
  }

  async depreciationReport() {
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
        purchaseCost: { not: null },
      },
    });

    return assets.map((asset) => {
      const purchaseCost = Number(asset.purchaseCost);
      const currentValue = asset.currentValue ? Number(asset.currentValue) : 0;
      const yearsElapsed = asset.purchaseDate
        ? (Date.now() - new Date(asset.purchaseDate).getTime()) /
          (365.25 * 24 * 3600 * 1000)
        : 0;

      return {
        id: asset.id,
        assetCode: asset.assetCode,
        name: asset.name,
        purchaseDate: asset.purchaseDate,
        purchaseCost,
        currentValue,
        depreciationMethod: asset.depreciationMethod,
        depreciationRate: asset.depreciationRate
          ? Number(asset.depreciationRate)
          : null,
        usefulLifeYears: asset.usefulLifeYears,
        yearsElapsed: Math.round(yearsElapsed * 100) / 100,
        depreciationAmount: Math.round((purchaseCost - currentValue) * 100) / 100,
      };
    });
  }

  async auditReport(planId: string) {
    return this.auditStatusReport({ planId });
  }

  async auditStatusReport(filter: {
    planId?: string;
    status?: string;
    locationId?: string;
  }) {
    const whereSession: Record<string, any> = {};
    if (filter.planId) whereSession.planId = filter.planId;
    if (filter.locationId) whereSession.locationId = filter.locationId;

    const whereItem: Record<string, any> = {};
    if (filter.status && filter.status !== 'ALL') {
      whereItem.status = filter.status;
    }
    if (Object.keys(whereSession).length > 0) {
      whereItem.session = whereSession;
    }

    const [allPlans, items] = await Promise.all([
      this.prisma.auditPlan.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          scheduledDate: true,
          _count: { select: { sessions: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditItem.findMany({
        where: whereItem,
        include: {
          session: {
            include: {
              plan: { select: { id: true, name: true, type: true, status: true } },
              location: { select: { id: true, name: true, code: true } },
              auditor: { select: { id: true, name: true, email: true } },
            },
          },
          asset: {
            include: {
              category: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
            },
          },
          expectedLocation: { select: { id: true, name: true, code: true } },
          foundLocation: { select: { id: true, name: true, code: true } },
          discrepancy: true,
        },
        orderBy: { scannedAt: 'desc' },
      }),
    ]);

    const totalItems = items.length;
    let verifiedCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;
    let damagedCount = 0;
    let pendingCount = 0;

    let conditionGoodCount = 0;
    let conditionFairCount = 0;
    let conditionDamagedCount = 0;

    let totalDiscrepancies = 0;
    let resolvedDiscrepancies = 0;

    for (const item of items) {
      if (item.status === 'VERIFIED') verifiedCount++;
      else if (item.status === 'MISMATCH') mismatchCount++;
      else if (item.status === 'MISSING') missingCount++;
      else if (item.status === 'DAMAGED') damagedCount++;
      else pendingCount++;

      if (item.condition === 'GOOD') conditionGoodCount++;
      else if (item.condition === 'FAIR') conditionFairCount++;
      else if (item.condition === 'DAMAGED') conditionDamagedCount++;

      if (item.discrepancy) {
        totalDiscrepancies++;
        if (item.discrepancy.resolvedAt) resolvedDiscrepancies++;
      }
    }

    const complianceRate =
      totalItems > 0 ? Math.round((verifiedCount / totalItems) * 100) : 0;

    return {
      summary: {
        totalPlans: allPlans.length,
        totalItems,
        verifiedCount,
        mismatchCount,
        missingCount,
        damagedCount,
        pendingCount,
        conditionGoodCount,
        conditionFairCount,
        conditionDamagedCount,
        totalDiscrepancies,
        resolvedDiscrepancies,
        complianceRate,
      },
      plans: allPlans,
      items: items.map((i) => ({
        id: i.id,
        planId: i.session.plan.id,
        planName: i.session.plan.name,
        planStatus: i.session.plan.status,
        sessionId: i.sessionId,
        stationName: i.session.location?.name || 'All Scoped Stations',
        stationCode: i.session.location?.code || '-',
        auditorName: i.session.auditor?.name || 'Assigned Staff',
        assetId: i.assetId,
        assetCode: i.asset.assetCode,
        sapAssetCode: i.asset.sapAssetCode,
        assetName: i.asset.name,
        model: i.asset.model,
        category: i.asset.category?.name || '-',
        department: i.asset.department?.name || '-',
        expectedLocation: i.expectedLocation?.name || 'Unassigned',
        physicalLocation: i.foundLocation?.name || 'Not scanned yet',
        physicalLocationCode: i.foundLocation?.code || '',
        status: i.status,
        condition: i.condition || '-',
        notes: i.notes,
        scannedAt: i.scannedAt,
        hasDiscrepancy: Boolean(i.discrepancy),
        discrepancyType: i.discrepancy?.discrepancyType || null,
        discrepancyResolved: Boolean(i.discrepancy?.resolvedAt),
      })),
    };
  }

  async generateAuditStatusExcel(filter: {
    planId?: string;
    status?: string;
    locationId?: string;
  }): Promise<Buffer> {
    const report = await this.auditStatusReport(filter);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Assets Management System';
    workbook.created = new Date();

    // Sheet 1: Executive KPI Summary
    const summarySheet = workbook.addWorksheet('Executive Summary');
    summarySheet.columns = [
      { header: 'Audit Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 22 },
      { header: 'Notes / Context', key: 'notes', width: 44 },
    ];

    const summaryRows = [
      { metric: 'Total Equipment in Scope', value: report.summary.totalItems, notes: 'Total records audited/scoped' },
      { metric: 'Verified at Station', value: report.summary.verifiedCount, notes: 'Physically verified at expected station' },
      { metric: 'Relocated (Location Mismatch)', value: report.summary.mismatchCount, notes: 'Found stationed at different room' },
      { metric: 'Damaged Equipment', value: report.summary.damagedCount, notes: 'Reported defects/wear' },
      { metric: 'Missing Equipment', value: report.summary.missingCount, notes: 'Not located during floor verification' },
      { metric: 'Pending Scan', value: report.summary.pendingCount, notes: 'Awaiting floor audit' },
      { metric: 'Station Compliance Rate', value: `${report.summary.complianceRate}%`, notes: 'Verified / Total scoped' },
      { metric: 'Total Discrepancies', value: report.summary.totalDiscrepancies, notes: 'Flagged reconciliation anomalies' },
      { metric: 'Resolved Discrepancies', value: report.summary.resolvedDiscrepancies, notes: 'Reviewed & resolved anomalies' },
      { metric: 'Condition - Good', value: report.summary.conditionGoodCount, notes: 'Optimal operational condition' },
      { metric: 'Condition - Fair', value: report.summary.conditionFairCount, notes: 'Normal operational wear' },
      { metric: 'Condition - Damaged', value: report.summary.conditionDamagedCount, notes: 'Needs repair/maintenance' },
    ];

    for (const r of summaryRows) {
      summarySheet.addRow(r);
    }

    const sHeader = summarySheet.getRow(1);
    sHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    // Sheet 2: Detailed Item-by-Item Reconciliation
    const itemsSheet = workbook.addWorksheet('Reconciliation Checklist');
    itemsSheet.columns = [
      { header: 'Audit Plan', key: 'planName', width: 28 },
      { header: 'Station', key: 'stationName', width: 18 },
      { header: 'Asset Code', key: 'assetCode', width: 18 },
      { header: 'SAP Code', key: 'sapAssetCode', width: 18 },
      { header: 'Equipment Name', key: 'assetName', width: 26 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Expected Location', key: 'expectedLocation', width: 20 },
      { header: 'Physical Location', key: 'physicalLocation', width: 20 },
      { header: 'Audit Status', key: 'status', width: 16 },
      { header: 'Condition', key: 'condition', width: 14 },
      { header: 'Discrepancy', key: 'discrepancyType', width: 20 },
      { header: 'Auditor', key: 'auditorName', width: 20 },
      { header: 'Scanned Timestamp', key: 'scannedAt', width: 22 },
      { header: 'Notes', key: 'notes', width: 28 },
    ];

    const iHeader = itemsSheet.getRow(1);
    iHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    iHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

    for (const item of report.items) {
      const row = itemsSheet.addRow({
        ...item,
        scannedAt: item.scannedAt ? new Date(item.scannedAt).toLocaleString() : '-',
        discrepancyType: item.discrepancyType || 'None',
        notes: item.notes || '-',
      });

      if (item.status === 'MISMATCH') {
        row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else if (item.status === 'DAMAGED' || item.status === 'MISSING') {
        row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      } else if (item.status === 'VERIFIED') {
        row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async maintenanceCostReport(filter: {
    assetId?: string;
    vendorId?: string;
    from?: string;
    to?: string;
  }) {
    const where: Record<string, any> = { status: 'COMPLETED' };
    if (filter.assetId) where.assetId = filter.assetId;
    if (filter.vendorId) where.vendorId = filter.vendorId;
    if (filter.from || filter.to) {
      where.completedAt = {};
      if (filter.from) where.completedAt.gte = new Date(filter.from);
      if (filter.to) where.completedAt.lte = new Date(filter.to);
    }

    const records = await this.prisma.maintenanceRecord.findMany({
      where,
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
        vendor: { select: { id: true, name: true } },
      },
    });

    const totalCost = records.reduce(
      (sum, r) => sum + (r.cost ? Number(r.cost) : 0),
      0,
    );

    return {
      records: records.map((r) => ({
        id: r.id,
        asset: r.asset,
        vendor: r.vendor,
        type: r.type,
        status: r.status,
        scheduledDate: r.scheduledAt,
        completedDate: r.completedAt,
        cost: r.cost ? Number(r.cost) : null,
        description: r.description,
        notes: r.notes,
      })),
      summary: {
        totalRecords: records.length,
        totalCost: Math.round(totalCost * 100) / 100,
      },
    };
  }

  private async exportToExcel(
    data: Record<string, any>[],
    sheetName: string,
    columns: { header: string; key: string; width?: number }[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? 20,
    }));

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    for (const item of data) {
      worksheet.addRow(item);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateAssetSummaryExcel(filter: {
    departmentId?: string;
    categoryId?: string;
    status?: string;
  }): Promise<Buffer> {
    const data = await this.assetSummaryReport(filter);

    const columns = [
      { header: 'Asset Code', key: 'assetCode', width: 18 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Purchase Cost', key: 'purchaseCost', width: 16 },
      { header: 'Current Value', key: 'currentValue', width: 16 },
      { header: 'Depreciation Method', key: 'depreciationMethod', width: 22 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 16 },
      { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 16 },
    ];

    return this.exportToExcel(data, 'Asset Summary', columns);
  }

  async generateDepreciationExcel(): Promise<Buffer> {
    const data = await this.depreciationReport();

    const columns = [
      { header: 'Asset Code', key: 'assetCode', width: 18 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 16 },
      { header: 'Purchase Cost', key: 'purchaseCost', width: 16 },
      { header: 'Current Value', key: 'currentValue', width: 16 },
      { header: 'Depreciation Method', key: 'depreciationMethod', width: 22 },
      { header: 'Depreciation Rate (%)', key: 'depreciationRate', width: 22 },
      { header: 'Useful Life (Years)', key: 'usefulLifeYears', width: 20 },
      { header: 'Years Elapsed', key: 'yearsElapsed', width: 16 },
      { header: 'Depreciation Amount', key: 'depreciationAmount', width: 22 },
    ];

    return this.exportToExcel(data, 'Depreciation Report', columns);
  }
}
