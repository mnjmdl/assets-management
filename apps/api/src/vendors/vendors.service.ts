import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@repo/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

interface FindAllFilter {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [total, active, inactive, totalAssetsSupplied, totalServiceOrders] =
      await Promise.all([
        this.prisma.vendor.count(),
        this.prisma.vendor.count({ where: { isActive: true } }),
        this.prisma.vendor.count({ where: { isActive: false } }),
        this.prisma.asset.count({ where: { vendorId: { not: null } } }),
        this.prisma.maintenanceRecord.count({ where: { vendorId: { not: null } } }),
      ]);

    return {
      total,
      active,
      inactive,
      totalAssetsSupplied,
      totalServiceOrders,
    };
  }

  async create(dto: CreateVendorDto) {
    let code = dto.code?.trim();
    if (!code) {
      const count = await this.prisma.vendor.count();
      code = `VND-${String(count + 1).padStart(3, '0')}`;
    }

    return this.prisma.vendor.create({
      data: {
        name: dto.name.trim(),
        code,
        contactPerson: dto.contactPerson?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        website: dto.website?.trim() || null,
        serviceTypes: dto.serviceTypes?.trim() || null,
      },
    });
  }

  async findAll(filter: FindAllFilter = {}) {
    const { page = 1, limit = 20, search, isActive } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.VendorWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              assets: true,
              maintenanceRecords: true,
              maintenanceSchedules: true,
            },
          },
        },
      }),
      this.prisma.vendor.count({ where }),
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
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assets: true,
            maintenanceRecords: true,
            maintenanceSchedules: true,
          },
        },
        assets: {
          take: 10,
          select: {
            id: true,
            name: true,
            assetCode: true,
            status: true,
            purchaseCost: true,
          },
        },
        maintenanceRecords: {
          take: 5,
          orderBy: { scheduledAt: 'desc' },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            scheduledAt: true,
            cost: true,
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${id}" not found`);
    }

    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.findOne(id);

    return this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.code && { code: dto.code.trim() }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
        ...(dto.website !== undefined && { website: dto.website?.trim() || null }),
        ...(dto.serviceTypes !== undefined && { serviceTypes: dto.serviceTypes?.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
