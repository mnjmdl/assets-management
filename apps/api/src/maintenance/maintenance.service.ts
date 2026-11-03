import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@repo/database';
import { MaintenanceType, MaintenanceStatus } from '@repo/types';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateRecordDto } from './dto/create-record.dto';
import { CompleteMaintainanceDto } from './dto/complete-maintenance.dto';

export interface ScheduleFilter {
  assetId?: string;
  type?: MaintenanceType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface RecordFilter {
  assetId?: string;
  status?: MaintenanceStatus;
  type?: MaintenanceType;
  vendorId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats() {
    const [totalRecords, scheduled, inProgress, completed, cancelled, activeSchedules, costAgg] =
      await Promise.all([
        this.prisma.maintenanceRecord.count(),
        this.prisma.maintenanceRecord.count({ where: { status: 'SCHEDULED' } }),
        this.prisma.maintenanceRecord.count({ where: { status: 'IN_PROGRESS' } }),
        this.prisma.maintenanceRecord.count({ where: { status: 'COMPLETED' } }),
        this.prisma.maintenanceRecord.count({ where: { status: 'CANCELLED' } }),
        this.prisma.maintenanceSchedule.count({ where: { isActive: true } }),
        this.prisma.maintenanceRecord.aggregate({
          _sum: { cost: true },
          where: { status: 'COMPLETED' },
        }),
      ]);

    return {
      total: totalRecords,
      scheduled,
      inProgress,
      completed,
      cancelled,
      activeSchedules,
      totalSpent: costAgg._sum.cost ? Number(costAgg._sum.cost) : 0,
    };
  }

  // ─── Schedules ────────────────────────────────────────────────────────────

  async createSchedule(dto: CreateScheduleDto) {
    const now = new Date();
    const nextDueDate = dto.nextDueDate
      ? new Date(dto.nextDueDate)
      : new Date(now.getTime() + dto.frequencyDays * 24 * 60 * 60 * 1000);

    return this.prisma.maintenanceSchedule.create({
      data: {
        assetId: dto.assetId,
        type: dto.type as any,
        title: (dto as any).title || dto.description || 'Preventive Maintenance',
        frequencyDays: dto.frequencyDays,
        description: dto.description,
        nextDueDate,
        isActive: true,
      },
      include: {
        asset: {
          select: { id: true, name: true, assetCode: true },
        },
      },
    });
  }

  async findAllSchedules(filter: ScheduleFilter) {
    const { assetId, type, isActive, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.MaintenanceScheduleWhereInput = {};
    if (assetId) where.assetId = assetId;
    if (type) where.type = type as any;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nextDueDate: 'asc' },
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              assetCode: true,
              sapAssetCode: true,
              model: true,
              status: true,
              location: { select: { id: true, name: true, code: true } },
              category: { select: { id: true, name: true, code: true } },
            },
          },
          vendor: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Records ──────────────────────────────────────────────────────────────

  async createRecord(dto: CreateRecordDto) {
    const totalCost = (dto.cost || 0) + (dto.laborCost || 0);
    const notesWithLabor = dto.laborCost
      ? `${dto.notes || ''} [Labor: BDT ${dto.laborCost}]`.trim()
      : dto.notes;

    const record = await this.prisma.maintenanceRecord.create({
      data: {
        assetId: dto.assetId,
        scheduleId: dto.scheduleId,
        type: dto.type as any,
        status: 'SCHEDULED' as any,
        title: (dto as any).title || dto.description || 'Maintenance Service',
        description: dto.description,
        performedById: dto.performedById,
        vendorId: dto.vendorId,
        scheduledAt: dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(),
        cost: new Prisma.Decimal(totalCost),
        notes: notesWithLabor,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetCode: true,
            sapAssetCode: true,
            model: true,
            status: true,
            location: { select: { id: true, name: true, code: true } },
            category: { select: { id: true, name: true, code: true } },
          },
        },
        vendor: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Mark the asset as IN_MAINTENANCE
    await this.prisma.asset.update({
      where: { id: dto.assetId },
      data: { status: 'IN_MAINTENANCE' as any },
    });

    return record;
  }

  async findAllRecords(filter: RecordFilter) {
    const { assetId, status, type, vendorId, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.MaintenanceRecordWhereInput = {};
    if (assetId) where.assetId = assetId;
    if (status) where.status = status;
    if (type) where.type = type as any;
    if (vendorId) where.vendorId = vendorId;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              assetCode: true,
              sapAssetCode: true,
              model: true,
              status: true,
              location: { select: { id: true, name: true, code: true } },
              category: { select: { id: true, name: true, code: true } },
            },
          },
          vendor: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true, email: true } },
          schedule: true,
        },
      }),
      this.prisma.maintenanceRecord.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneRecord(id: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
        vendor: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true } },
        schedule: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Maintenance record with id "${id}" not found`);
    }

    return record;
  }

  async startMaintenance(id: string) {
    const record = await this.findOneRecord(id);

    if (record.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Cannot start maintenance: current status is "${record.status}", expected "SCHEDULED"`,
      );
    }

    return this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS' as any,
        startedAt: new Date(),
      },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
        vendor: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true } },
      },
    });
  }

  async completeMaintenance(id: string, dto: CompleteMaintainanceDto) {
    const record = await this.findOneRecord(id);

    if (record.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot complete maintenance: current status is "${record.status}", expected "IN_PROGRESS"`,
      );
    }

    const now = new Date();
    const totalCost =
      dto.cost !== undefined || dto.laborCost !== undefined
        ? (dto.cost || 0) + (dto.laborCost || 0)
        : undefined;

    let updatedNotes = dto.notes;
    if (dto.laborCost) {
      updatedNotes = `${updatedNotes || record.notes || ''} [Labor: BDT ${dto.laborCost}]`.trim();
    }

    const updatedRecord = await this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        status: 'COMPLETED' as any,
        completedAt: now,
        ...(totalCost !== undefined && { cost: new Prisma.Decimal(totalCost) }),
        ...(updatedNotes !== undefined && { notes: updatedNotes }),
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetCode: true,
            sapAssetCode: true,
            model: true,
            status: true,
            location: { select: { id: true, name: true, code: true } },
            category: { select: { id: true, name: true, code: true } },
          },
        },
        vendor: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true, email: true } },
        schedule: true,
      },
    });

    // Restore asset status to ACTIVE
    await this.prisma.asset.update({
      where: { id: record.assetId },
      data: { status: 'ACTIVE' as any },
    });

    // Update linked schedule if applicable
    if (record.scheduleId && updatedRecord.schedule) {
      const schedule = updatedRecord.schedule;
      const nextDueDate = dto.nextDueDate
        ? new Date(dto.nextDueDate)
        : schedule.frequencyDays
          ? new Date(now.getTime() + schedule.frequencyDays * 24 * 60 * 60 * 1000)
          : null;

      await this.prisma.maintenanceSchedule.update({
        where: { id: record.scheduleId },
        data: {
          lastDoneDate: now,
          nextDueDate,
        },
      });
    }

    return updatedRecord;
  }

  async cancelMaintenance(id: string) {
    const record = await this.findOneRecord(id);

    const cancellableStatuses: string[] = ['SCHEDULED', 'IN_PROGRESS'];
    if (!cancellableStatuses.includes(record.status as string)) {
      throw new BadRequestException(
        `Cannot cancel maintenance: current status is "${record.status}"`,
      );
    }

    const updatedRecord = await this.prisma.maintenanceRecord.update({
      where: { id },
      data: { status: 'CANCELLED' as any },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
        vendor: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true } },
      },
    });

    // Restore asset status to ACTIVE
    await this.prisma.asset.update({
      where: { id: record.assetId },
      data: { status: 'ACTIVE' as any },
    });

    return updatedRecord;
  }
}
