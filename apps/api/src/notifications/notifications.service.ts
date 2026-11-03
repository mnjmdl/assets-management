import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(
    userId: string,
    filter: { page?: number; limit?: number; unreadOnly?: boolean },
  ) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { userId };
    if (filter.unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this notification',
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    refId?: string;
    refType?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  @Cron('0 8 * * *')
  async sendMaintenanceDueAlerts() {
    const now = new Date();
    const sevenDaysFromNow = new Date(
      now.getTime() + 7 * 24 * 3600 * 1000,
    );

    const dueSchedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: sevenDaysFromNow },
      },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
      },
    });

    if (dueSchedules.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ASSET_MANAGER, Role.SUPER_ADMIN] },
        isActive: true,
      },
      select: { id: true },
    });

    const notifications: {
      userId: string;
      type: string;
      title: string;
      message: string;
      refId: string;
      refType: string;
    }[] = [];

    for (const manager of managers) {
      for (const schedule of dueSchedules) {
        notifications.push({
          userId: manager.id,
          type: 'MAINTENANCE_DUE',
          title: `Maintenance Due: ${schedule.asset.name}`,
          message: `Asset ${schedule.asset.assetCode} is due for maintenance on ${schedule.nextDueDate?.toDateString() || 'N/A'}`,
          refId: schedule.id,
          refType: 'MaintenanceSchedule',
        });
      }
    }

    if (notifications.length > 0) {
      await this.prisma.notification.createMany({ data: notifications });
    }
  }

  @Cron('0 9 * * 1')
  async sendWarrantyExpiryAlerts() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 3600 * 1000,
    );

    const expiringAssets = await this.prisma.asset.findMany({
      where: {
        isActive: true,
        warrantyExpiry: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      select: { id: true, name: true, assetCode: true, warrantyExpiry: true },
    });

    if (expiringAssets.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ASSET_MANAGER, Role.SUPER_ADMIN] },
        isActive: true,
      },
      select: { id: true },
    });

    const notifications: {
      userId: string;
      type: string;
      title: string;
      message: string;
      refId: string;
      refType: string;
    }[] = [];

    for (const manager of managers) {
      for (const asset of expiringAssets) {
        notifications.push({
          userId: manager.id,
          type: 'WARRANTY_EXPIRY',
          title: `Warranty Expiring: ${asset.name}`,
          message: `Asset ${asset.assetCode} warranty expires on ${asset.warrantyExpiry!.toDateString()}`,
          refId: asset.id,
          refType: 'Asset',
        });
      }
    }

    if (notifications.length > 0) {
      await this.prisma.notification.createMany({ data: notifications });
    }
  }
}
