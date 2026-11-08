import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransferStatus } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveTransferDto } from './dto/approve-transfer.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { RejectTransferDto } from './dto/reject-transfer.dto';

interface FindAllFilter {
  page?: number;
  limit?: number;
  assetId?: string;
  status?: TransferStatus;
  fromDeptId?: string;
  toDeptId?: string;
}

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [total, pending, approved, completed, rejected] = await Promise.all([
      this.prisma.assetTransfer.count(),
      this.prisma.assetTransfer.count({ where: { status: TransferStatus.PENDING } }),
      this.prisma.assetTransfer.count({ where: { status: TransferStatus.APPROVED } }),
      this.prisma.assetTransfer.count({ where: { status: TransferStatus.COMPLETED } }),
      this.prisma.assetTransfer.count({ where: { status: TransferStatus.REJECTED } }),
    ]);

    return {
      total,
      pending,
      approved,
      completed,
      rejected,
    };
  }

  async getDepartments() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateTransferDto, requestedById?: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: {
        department: true,
        location: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID "${dto.assetId}" not found`);
    }

    // Prevent duplicate active transfer requests for the same asset
    const existingActiveTransfer = await this.prisma.assetTransfer.findFirst({
      where: {
        assetId: dto.assetId,
        status: { in: [TransferStatus.PENDING, TransferStatus.APPROVED] },
      },
    });

    if (existingActiveTransfer) {
      throw new BadRequestException(
        `A transfer request for asset "${asset.assetCode}" is already ${existingActiveTransfer.status.toLowerCase()} (#${existingActiveTransfer.id}). A new transfer request can only be submitted once the current one is finalized or rejected.`,
      );
    }

    // Resolve valid user ID
    let validUserId =
      typeof requestedById === 'object' && requestedById !== null
        ? (requestedById as any).id
        : requestedById;
    if (!validUserId || validUserId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) validUserId = admin.id;
    }

    // If target location is provided, resolve location name and encode into notes
    let notes = dto.reason;
    if (dto.toLocationId) {
      const loc = await this.prisma.location.findUnique({ where: { id: dto.toLocationId } });
      if (loc) {
        notes = `[TO_LOC:${loc.id}:${loc.name}] ${dto.reason || ''}`.trim();
      }
    }

    return this.prisma.assetTransfer.create({
      data: {
        assetId: dto.assetId,
        fromDeptId: asset.departmentId,
        toDeptId: dto.toDeptId || asset.departmentId,
        requestedById: validUserId!,
        reason: dto.reason,
        notes,
        status: TransferStatus.PENDING,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetCode: true,
            location: { select: { id: true, name: true, code: true } },
          },
        },
        fromDept: { select: { id: true, name: true, code: true } },
        toDept: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAll(filter: FindAllFilter = {}) {
    const { page = 1, limit = 20, assetId, status, fromDeptId, toDeptId } = filter;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (assetId) where.assetId = assetId;
    if (status && status !== ('ALL' as any)) where.status = status;
    if (fromDeptId) where.fromDeptId = fromDeptId;
    if (toDeptId) where.toDeptId = toDeptId;

    const [data, total] = await Promise.all([
      this.prisma.assetTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
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
              category: { select: { id: true, name: true } },
            },
          },
          fromDept: { select: { id: true, name: true, code: true } },
          toDept: { select: { id: true, name: true, code: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.assetTransfer.count({ where }),
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

  async findOne(id: string) {
    const transfer = await this.prisma.assetTransfer.findUnique({
      where: { id },
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
            category: { select: { id: true, name: true } },
          },
        },
        fromDept: { select: { id: true, name: true, code: true } },
        toDept: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with ID "${id}" not found`);
    }

    return transfer;
  }

  async approve(id: string, approvedById?: string, dto: ApproveTransferDto = {}) {
    const transfer = await this.findOne(id);

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(
        `Transfer is not in PENDING status. Current status: ${transfer.status}`,
      );
    }

    let validUserId =
      typeof approvedById === 'object' && approvedById !== null
        ? (approvedById as any).id
        : approvedById;
    if (!validUserId || validUserId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) validUserId = admin.id;
    }

    return this.prisma.assetTransfer.update({
      where: { id },
      data: {
        status: TransferStatus.APPROVED,
        approvedById: validUserId,
        approvedAt: new Date(),
        ...(dto.notes ? { reason: dto.notes } : {}),
      },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
        fromDept: { select: { id: true, name: true } },
        toDept: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
  }

  async reject(id: string, rejectedById?: string, dto: RejectTransferDto = { rejectionReason: 'Transfer rejected' }) {
    const transfer = await this.findOne(id);

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(
        `Transfer is not in PENDING status. Current status: ${transfer.status}`,
      );
    }

    let validUserId =
      typeof rejectedById === 'object' && rejectedById !== null
        ? (rejectedById as any).id
        : rejectedById;
    if (!validUserId || validUserId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) validUserId = admin.id;
    }

    return this.prisma.assetTransfer.update({
      where: { id },
      data: {
        status: TransferStatus.REJECTED,
        notes: dto.rejectionReason,
        approvedById: validUserId,
        approvedAt: new Date(),
      },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
        fromDept: { select: { id: true, name: true } },
        toDept: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
  }

  async complete(id: string, userId?: string) {
    const transfer = await this.findOne(id);

    if (transfer.status !== TransferStatus.APPROVED) {
      throw new BadRequestException(
        `Transfer is not in APPROVED status. Current status: ${transfer.status}`,
      );
    }

    // Check if target location is encoded in notes: [TO_LOC:cmvx...:Location Name]
    const locMatch = transfer.notes?.match(/\[TO_LOC:([^:]+):/);
    const targetLocId = locMatch ? locMatch[1] : null;

    const assetUpdateData: Record<string, any> = {};
    if (transfer.toDeptId) assetUpdateData.departmentId = transfer.toDeptId;
    if (targetLocId) assetUpdateData.locationId = targetLocId;

    const [updatedTransfer] = await this.prisma.$transaction([
      this.prisma.assetTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              assetCode: true,
              location: { select: { id: true, name: true, code: true } },
            },
          },
          fromDept: { select: { id: true, name: true } },
          toDept: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.asset.update({
        where: { id: transfer.assetId },
        data: assetUpdateData,
      }),
    ]);

    // When transfer is finalized, automatically update session inventory checklist items
    if (targetLocId) {
      const targetLoc = await this.prisma.location.findUnique({
        where: { id: targetLocId },
        select: { id: true, name: true, code: true },
      });

      let validUserId =
        typeof userId === 'object' && userId !== null
          ? (userId as any).id
          : userId;
      if (!validUserId || validUserId === 'admin') {
        const admin = await this.prisma.user.findFirst({ select: { id: true } });
        if (admin) validUserId = admin.id;
      }

      // Find all audit items for this asset that were flagged as mismatch or scanned at target station
      const affectedAuditItems = await this.prisma.auditItem.findMany({
        where: {
          assetId: transfer.assetId,
          OR: [
            { status: 'LOCATION_MISMATCH' },
            { status: 'MISMATCH' },
            { foundLocationId: targetLocId },
          ],
        },
      });

      for (const item of affectedAuditItems) {
        await this.prisma.auditItem.update({
          where: { id: item.id },
          data: {
            status: item.condition === 'DAMAGED' ? 'DAMAGED' : 'VERIFIED',
            expectedLocationId: targetLocId,
            notes: item.notes
              ? `${item.notes} | Transferred to ${targetLoc?.name || targetLocId}`
              : `Transferred to ${targetLoc?.name || targetLocId}`,
          },
        });

        // Resolve any open discrepancy linked to this audit item
        await this.prisma.auditDiscrepancy.updateMany({
          where: {
            auditItemId: item.id,
            resolvedAt: null,
          },
          data: {
            resolvedAt: new Date(),
            resolvedById: validUserId || undefined,
            resolutionNotes: `Location transfer completed: Relocated to ${targetLoc?.name || targetLocId}`,
          },
        });
      }
    }

    return updatedTransfer;
  }
}
