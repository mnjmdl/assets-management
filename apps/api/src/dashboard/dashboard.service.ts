import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKPIs(userId: string, role: string) {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalAssets,
      activeAssets,
      assetsInMaintenance,
      totalAssetValueResult,
      maintenanceDueSoon,
      warrantyExpiringSoon,
      pendingTransfers,
      openAudits,
      assetsByStatus,
      assetsByCategoryRaw,
      recentActivity,
    ] = await Promise.all([
      // Total active assets
      this.prisma.asset.count({
        where: { isActive: true },
      }),

      // Active assets (status = ACTIVE)
      this.prisma.asset.count({
        where: { isActive: true, status: 'ACTIVE' as any },
      }),

      // Assets currently in maintenance
      this.prisma.asset.count({
        where: { isActive: true, status: 'IN_MAINTENANCE' as any },
      }),

      // Total asset value (sum of currentValue)
      this.prisma.asset.aggregate({
        _sum: { currentValue: true },
        where: { isActive: true },
      }),

      // Maintenance schedules due within 7 days
      this.prisma.maintenanceSchedule.count({
        where: {
          isActive: true,
          nextDueDate: { lte: sevenDaysFromNow },
        },
      }),

      // Assets with warranty expiring in the next 30 days
      this.prisma.asset.count({
        where: {
          isActive: true,
          warrantyExpiry: {
            lte: thirtyDaysFromNow,
            gt: now,
          },
        },
      }),

      // Pending asset transfers
      this.prisma.assetTransfer.count({
        where: { status: 'PENDING' as any },
      }),

      // Open audits (published or in progress)
      this.prisma.auditPlan.count({
        where: {
          status: { in: ['PUBLISHED', 'IN_PROGRESS'] as any[] },
        },
      }),

      // Assets grouped by status
      this.prisma.asset.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { isActive: true },
      }),

      // Assets grouped by category (top 5 by count)
      this.prisma.asset.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        _sum: { currentValue: true },
        where: { isActive: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Recent activity from audit trail
      this.prisma.auditTrail.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    // Resolve category names for the grouped category data
    const categoryIds = assetsByCategoryRaw
      .map((row) => row.categoryId)
      .filter((id): id is string => id !== null);

    const categories = categoryIds.length
      ? await this.prisma.assetCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const assetsByCategory = assetsByCategoryRaw.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryId ? (categoryMap.get(row.categoryId) ?? 'Unknown') : 'Uncategorised',
      count: row._count.id,
      totalValue: Number(row._sum.currentValue ?? 0),
    }));

    return {
      totalAssets,
      activeAssets,
      assetsInMaintenance,
      totalAssetValue: Number(totalAssetValueResult._sum.currentValue ?? 0),
      maintenanceDueSoon,
      warrantyExpiringSoon,
      pendingTransfers,
      openAudits,
      assetsByStatus: assetsByStatus.map((row) => ({
        status: row.status,
        count: row._count.id,
      })),
      assetsByCategory,
      recentActivity,
    };
  }
}
