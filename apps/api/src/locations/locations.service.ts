import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@repo/database';
import { LocationType } from '@repo/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationFilterDto } from './dto/location-filter.dto';

const EXPECTED_PARENT_TYPE: Record<LocationType, LocationType | null> = {
  [LocationType.COMPANY]: null,
  [LocationType.UNIT]: LocationType.COMPANY,
  [LocationType.BLOCK]: LocationType.UNIT,
  [LocationType.LINE]: LocationType.BLOCK,
};

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Hierarchy Validator ─────────────────────────────────────────────────────
  private async validateHierarchy(type: LocationType, parentId?: string) {
    const expectedParent = EXPECTED_PARENT_TYPE[type];

    if (type === LocationType.COMPANY) {
      if (parentId) {
        throw new BadRequestException('A COMPANY is the top-level location and cannot have a parent');
      }
      return;
    }

    if (!parentId) {
      throw new BadRequestException(
        `A ${type} must belong to a parent ${expectedParent}. Please select a parent ${expectedParent}.`,
      );
    }

    const parent = await this.prisma.location.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new BadRequestException(`Parent location with ID "${parentId}" does not exist`);
    }

    if (parent.type !== expectedParent) {
      throw new BadRequestException(
        `Invalid hierarchy: A ${type} must belong to a ${expectedParent}, but selected parent "${parent.name}" is a ${parent.type}. (Hierarchy: Company > Unit > Block > Line)`,
      );
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async create(dto: CreateLocationDto) {
    const existing = await this.prisma.location.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Location code "${dto.code}" is already in use`);
    }

    await this.validateHierarchy(dto.type, dto.parentId);

    const qrCode = `LOC:${dto.code.toUpperCase()}`;

    return this.prisma.location.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        type: dto.type,
        qrCode,
        building: dto.building,
        floor: dto.floor,
        room: dto.room,
        description: dto.description,
        parentId: dto.parentId,
      },
      include: {
        parent: { select: { id: true, name: true, code: true, type: true } },
      },
    });
  }

  // ── Find All (Flat with filters & pagination) ───────────────────────────────
  async findAll(filter: LocationFilterDto) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      parentId,
      isActive = true,
    } = filter;

    const skip = (page - 1) * limit;

    const where: Prisma.LocationWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(type && { type }),
      ...(parentId !== undefined && { parentId }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { id: true, name: true, code: true, type: true } },
          _count: {
            select: {
              assets: true,
              children: true,
            },
          },
        },
      }),
      this.prisma.location.count({ where }),
    ]);

    // Calculate rolled-up total asset counts including all descendant children
    const allLocationsForCounts = await this.prisma.location.findMany({
      where: { isActive: true },
      select: {
        id: true,
        parentId: true,
        _count: { select: { assets: true } },
      },
    });

    const parentMap = new Map<string, string | null>();
    const countMap = new Map<string, number>();
    for (const l of allLocationsForCounts) {
      parentMap.set(l.id, l.parentId);
      countMap.set(l.id, l._count?.assets ?? 0);
    }

    const rolledUpCounts = new Map<string, number>();
    for (const l of allLocationsForCounts) {
      const own = countMap.get(l.id) || 0;
      if (own === 0) continue;
      let cur: string | null | undefined = l.id;
      while (cur) {
        rolledUpCounts.set(cur, (rolledUpCounts.get(cur) || 0) + own);
        cur = parentMap.get(cur);
      }
    }

    const formattedData = data.map((loc) => {
      const rolledTotal = rolledUpCounts.get(loc.id) || loc._count?.assets || 0;
      return {
        ...loc,
        assetCount: rolledTotal,
        totalAssetCount: rolledTotal,
        directAssetCount: loc._count?.assets ?? 0,
      };
    });

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  // ── Find Tree: Company > Unit > Block > Line ────────────────────────────────
  async findTree() {
    const allLocations = await this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    const locationMap = new Map<string, any>();
    const tree: any[] = [];

    allLocations.forEach((loc) => {
      locationMap.set(loc.id, {
        ...loc,
        directAssetCount: loc._count?.assets ?? 0,
        assetCount: loc._count?.assets ?? 0,
        children: [],
      });
    });

    allLocations.forEach((loc) => {
      const node = locationMap.get(loc.id);
      if (loc.parentId && locationMap.has(loc.parentId)) {
        locationMap.get(loc.parentId).children.push(node);
      } else if (loc.type === LocationType.COMPANY || !loc.parentId) {
        tree.push(node);
      }
    });

    // Roll up child asset counts into parents
    const rollupAssets = (node: any): number => {
      let count = node.directAssetCount ?? node._count?.assets ?? 0;
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          count += rollupAssets(child);
        }
      }
      node.totalAssetCount = count;
      node.assetCount = count;
      return count;
    };

    tree.forEach(rollupAssets);

    return tree;
  }

  // ── Find One with Breadcrumb Path ───────────────────────────────────────────
  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            _count: { select: { assets: true, children: true } },
          },
        },
        _count: {
          select: {
            assets: true,
            assignments: true,
            auditSessions: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    // Build hierarchy breadcrumb (e.g. Acme > Unit 1 > Block A > Line 1)
    const breadcrumbs: { id: string; name: string; code: string; type: string }[] = [];
    let current: any = location;
    while (current) {
      breadcrumbs.unshift({
        id: current.id,
        name: current.name,
        code: current.code,
        type: current.type,
      });
      current = current.parent;
    }

    // Roll up assets quantity including all descendant children
    const allLocations = await this.prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, parentId: true },
    });
    const descendantIds = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      for (const l of allLocations) {
        if (l.parentId && descendantIds.has(l.parentId) && !descendantIds.has(l.id)) {
          descendantIds.add(l.id);
          added = true;
        }
      }
    }
    const totalAssetCount = await this.prisma.asset.count({
      where: {
        isActive: true,
        locationId: { in: Array.from(descendantIds) },
      },
    });

    return {
      ...location,
      assetCount: totalAssetCount,
      totalAssetCount,
      directAssetCount: location._count?.assets ?? 0,
      breadcrumbs,
      fullPath: breadcrumbs.map((b) => b.name).join(' > '),
    };
  }

  // ── Find by Code or QR Tag ──────────────────────────────────────────────────
  async findByCode(code: string) {
    const raw = code.trim();
    const cleanCode = raw.replace(/^LOC:/i, '').trim();

    const location = await this.prisma.location.findFirst({
      where: {
        OR: [
          { code: cleanCode.toUpperCase() },
          { code: raw.toUpperCase() },
          { qrCode: raw },
          { qrCode: `LOC:${cleanCode.toUpperCase()}` },
          { id: raw },
          { id: cleanCode },
        ],
      },
    });

    if (!location) {
      throw new NotFoundException(`Location with code "${code}" not found`);
    }

    return this.findOne(location.id);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateLocationDto) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    const targetType = (dto.type || location.type) as LocationType;
    const targetParentId = dto.parentId !== undefined ? dto.parentId : (location.parentId || undefined);

    if (dto.code) {
      const existing = await this.prisma.location.findFirst({
        where: {
          code: dto.code.toUpperCase(),
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(`Location code "${dto.code}" is already in use`);
      }
    }

    if (dto.parentId === id) {
      throw new BadRequestException('A location cannot be its own parent');
    }

    if (dto.type || dto.parentId !== undefined) {
      await this.validateHierarchy(targetType, targetParentId);
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code ? dto.code.toUpperCase() : undefined,
        qrCode: dto.code ? `LOC:${dto.code.toUpperCase()}` : undefined,
        type: dto.type,
        building: dto.building,
        floor: dto.floor,
        room: dto.room,
        description: dto.description,
        parentId: dto.parentId,
        isActive: dto.isActive,
      },
      include: {
        parent: { select: { id: true, name: true, code: true, type: true } },
      },
    });
  }

  // ── Remove (Soft Delete) ────────────────────────────────────────────────────
  async remove(id: string) {
    const location = await this.findOne(id);

    if (location._count.assets > 0) {
      throw new BadRequestException(
        `Cannot deactivate location "${location.name}": ${location._count.assets} asset(s) are currently stationed here`,
      );
    }

    if (location.children.length > 0) {
      throw new BadRequestException(
        `Cannot deactivate location "${location.name}": It has ${location.children.length} sub-location(s). Deactivate child locations first.`,
      );
    }

    return this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
