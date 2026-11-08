import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditPlanStatus, AuditType } from '@repo/types';
import { CreateAuditPlanDto } from './dto/create-audit-plan.dto';
import { CreateAuditSessionDto } from './dto/create-audit-session.dto';
import { SubmitAuditItemDto } from './dto/submit-audit-item.dto';
import { ResolveDiscrepancyDto } from './dto/resolve-discrepancy.dto';
import { CommitLocationBatchDto } from './dto/commit-location-batch.dto';
import { QuickScanDto } from './dto/quick-scan.dto';

export interface FindAllPlansFilter {
  status?: AuditPlanStatus;
  type?: AuditType;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) { }

  private sessionsCache = new Map<string, { data: any; expiresAt: number }>();

  private getCachedSessionsResponse(key: string) {
    const entry = this.sessionsCache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.data;
    }
    if (entry) {
      this.sessionsCache.delete(key);
    }
    return null;
  }

  private setCachedSessionsResponse(key: string, data: any, ttlMs = 20000) {
    this.sessionsCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    if (this.sessionsCache.size > 100) {
      const oldestKey = this.sessionsCache.keys().next().value;
      if (oldestKey) this.sessionsCache.delete(oldestKey);
    }
  }

  public invalidateSessionsCache() {
    this.sessionsCache.clear();
  }

  // ─── Audit Plans ─────────────────────────────────────────────────────────────

  async createPlan(dto: CreateAuditPlanDto, createdById: string) {
    let validUserId = createdById;
    if (!validUserId || validUserId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) validUserId = admin.id;
    }

    const scopeIds = JSON.stringify(dto.scopeIds || []);
    const scopeType = dto.scopeType || 'ALL';

    const plan = await this.prisma.auditPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        status: 'DRAFT' as AuditPlanStatus,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
        scopeType,
        scopeIds,
        createdById: validUserId,
      },
    });

    return plan;
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.auditPlan.findUnique({
      where: { id },
      include: { sessions: { select: { id: true } } },
    });

    if (!plan) {
      throw new NotFoundException(`Audit plan with id ${id} not found`);
    }

    const sessionIds = plan.sessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await this.prisma.auditDiscrepancy.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
      await this.prisma.auditItem.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
      await this.prisma.auditSession.deleteMany({
        where: { id: { in: sessionIds } },
      });
    }

    return this.prisma.auditPlan.delete({
      where: { id },
    });
  }

  async findAllPlans(filter: FindAllPlansFilter = {}) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const { status, type } = filter;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.auditPlan.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: { select: { sessions: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditPlan.count({ where }),
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

  async findOnePlan(id: string) {
    const plan = await this.prisma.auditPlan.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        sessions: {
          include: {
            _count: { select: { items: true, discrepancies: true } },
            auditor: { select: { id: true, name: true, email: true } },
            location: { select: { id: true, name: true, code: true, type: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Audit plan with id ${id} not found`);
    }

    let scopedLocations: any[] = [];
    if (plan.scopeIds) {
      try {
        const ids = JSON.parse(plan.scopeIds);
        if (Array.isArray(ids) && ids.length > 0) {
          scopedLocations = await this.prisma.location.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, code: true, type: true, parentId: true },
          });
        }
      } catch { }
    }

    return {
      ...plan,
      scopedLocations,
    };
  }

  async updatePlan(id: string, dto: Partial<CreateAuditPlanDto>) {
    const plan = await this.findOnePlan(id);

    if (plan.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT plans can be updated. Current status: ${plan.status}`,
      );
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.scheduledDate !== undefined)
      updateData.scheduledDate = new Date(dto.scheduledDate);

    if (dto.scopeIds !== undefined) {
      updateData.scopeIds = JSON.stringify(dto.scopeIds);
    }

    if (dto.description !== undefined || dto.scopeType !== undefined) {
      const scopeType = dto.scopeType ?? this._parseScopeType(plan.description ?? '');
      const rawDescription =
        dto.description ?? this._parseRawDescription(plan.description ?? '');
      const scopePrefix = scopeType ? `[SCOPE_TYPE:${scopeType}] ` : '';
      updateData.description = rawDescription
        ? `${scopePrefix}${rawDescription}`
        : scopePrefix || undefined;
    }

    if (dto.type !== undefined) updateData.type = dto.type;

    return this.prisma.auditPlan.update({
      where: { id },
      data: updateData,
    });
  }

  async publishPlan(id: string) {
    const plan = await this.findOnePlan(id);

    if (plan.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT plans can be published. Current status: ${plan.status}`,
      );
    }

    return this.prisma.auditPlan.update({
      where: { id },
      data: { status: 'PUBLISHED' as AuditPlanStatus },
    });
  }

  // ─── Audit Sessions ───────────────────────────────────────────────────────────

  async createSession(dto: CreateAuditSessionDto) {
    // Fetch plan to retrieve scope information.
    const plan = await this.findOnePlan(dto.planId);

    // Resolve valid auditor ID
    let auditorId = dto.auditorId;
    if (!auditorId || auditorId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) auditorId = admin.id;
    }

    const session = await this.prisma.auditSession.create({
      data: {
        planId: dto.planId,
        auditorId,
        locationId: dto.locationId || undefined,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        notes: dto.notes,
      },
    });

    // Also update plan status to IN_PROGRESS if it was DRAFT or SCHEDULED
    if (plan.status === 'DRAFT' || plan.status === 'SCHEDULED') {
      await this.prisma.auditPlan.update({
        where: { id: plan.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Pre-populate AuditItems from plan scope or location.
    let scopeIds: string[] = [];
    try {
      scopeIds = JSON.parse(plan.scopeIds ?? '[]');
    } catch {
      scopeIds = [];
    }

    const scopeType = (plan as any).scopeType || this._parseScopeType(plan.description ?? '') || 'ALL';

    const assetWhere: Record<string, unknown> = { isActive: true };

    if (scopeType === 'LOCATION' && scopeIds.length > 0) {
      // Find all valid location IDs within the plan's location scope (parent + all descendants)
      const allLocs = await this.prisma.location.findMany({ select: { id: true, parentId: true } });
      const planAllowedLocIds = new Set<string>(scopeIds);
      let added = true;
      while (added) {
        added = false;
        for (const loc of allLocs) {
          if (loc.parentId && planAllowedLocIds.has(loc.parentId) && !planAllowedLocIds.has(loc.id)) {
            planAllowedLocIds.add(loc.id);
            added = true;
          }
        }
      }

      if (dto.locationId) {
        // If session specified a location, find descendants of dto.locationId and intersect
        const sessionLocIds = new Set<string>([dto.locationId]);
        let subAdded = true;
        while (subAdded) {
          subAdded = false;
          for (const loc of allLocs) {
            if (loc.parentId && sessionLocIds.has(loc.parentId) && !sessionLocIds.has(loc.id)) {
              sessionLocIds.add(loc.id);
              subAdded = true;
            }
          }
        }
        const validIds = Array.from(sessionLocIds).filter((id) => planAllowedLocIds.has(id));
        if (validIds.length === 0) {
          throw new BadRequestException('The selected session location is outside the audit plan scope');
        }
        assetWhere.locationId = { in: validIds };
      } else {
        assetWhere.locationId = { in: Array.from(planAllowedLocIds) };
      }
    } else if (dto.locationId) {
      // Plan is not restricted by location, but session targets a specific location
      const allLocs = await this.prisma.location.findMany({ select: { id: true, parentId: true } });
      const targetLocIds = new Set<string>([dto.locationId]);
      let added = true;
      while (added) {
        added = false;
        for (const loc of allLocs) {
          if (loc.parentId && targetLocIds.has(loc.parentId) && !targetLocIds.has(loc.id)) {
            targetLocIds.add(loc.id);
            added = true;
          }
        }
      }
      assetWhere.locationId = { in: Array.from(targetLocIds) };
    } else if (scopeType === 'DEPARTMENT' && scopeIds.length > 0) {
      assetWhere.departmentId = { in: scopeIds };
    } else if (scopeType === 'CATEGORY' && scopeIds.length > 0) {
      assetWhere.categoryId = { in: scopeIds };
    }

    const assets = await this.prisma.asset.findMany({
      where: assetWhere,
      select: { id: true, locationId: true },
    });

    if (assets.length > 0) {
      // Chunk insertions into batches of 1000 to comply with MSSQL query parameter limits
      const chunkSize = 1000;
      for (let i = 0; i < assets.length; i += chunkSize) {
        const chunk = assets.slice(i, i + chunkSize);
        await this.prisma.auditItem.createMany({
          data: chunk.map((asset) => ({
            sessionId: session.id,
            assetId: asset.id,
            expectedLocationId: asset.locationId,
            status: 'PENDING',
          })),
        });
      }
    }

    const itemCount = await this.prisma.auditItem.count({
      where: { sessionId: session.id },
    });

    this.invalidateSessionsCache();
    return { ...session, _count: { items: itemCount } };
  }

  async findAllSessions(query: {
    planId?: string;
    status?: string;
    locationId?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const { planId, status, locationId } = query;
    const cacheKey = JSON.stringify({ planId, status, locationId, page, limit });
    const cached = this.getCachedSessionsResponse(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * limit;
    const where: any = {};
    if (planId) where.planId = planId;
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;

    const [data, total] = await Promise.all([
      this.prisma.auditSession.findMany({
        where,
        skip,
        take: limit,
        include: {
          plan: { select: { id: true, name: true, type: true, status: true } },
          auditor: { select: { id: true, name: true, email: true } },
          location: { select: { id: true, name: true, code: true, type: true } },
          _count: { select: { items: true, discrepancies: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.auditSession.count({ where }),
    ]);

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    this.setCachedSessionsResponse(cacheKey, result, 20000);
    return result;
  }

  async findOneSession(id: string) {
    const session = await this.prisma.auditSession.findUnique({
      where: { id },
      include: {
        plan: true,
        auditor: { select: { id: true, name: true, email: true } },
        location: { select: { id: true, name: true, code: true, type: true } },
        _count: { select: { items: true, discrepancies: true } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
    }

    return session;
  }

  async deleteSession(id: string) {
    const session = await this.prisma.auditSession.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
    }

    await this.prisma.auditDiscrepancy.deleteMany({ where: { sessionId: id } });
    await this.prisma.auditItem.deleteMany({ where: { sessionId: id } });
    return this.prisma.auditSession.delete({ where: { id } });
  }

  async startSession(id: string, auditorId: string) {
    const session = await this.prisma.auditSession.findUnique({ where: { id } });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
    }

    if (session.status !== 'NOT_STARTED') {
      throw new BadRequestException(
        `Session can only be started when status is NOT_STARTED. Current: ${session.status}`,
      );
    }

    if (session.auditorId !== auditorId) {
      throw new ForbiddenException('You are not the assigned auditor for this session');
    }

    return this.prisma.auditSession.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  async submitAuditItem(
    sessionId: string,
    dto: SubmitAuditItemDto,
    auditorId: string,
  ) {
    // Verify session exists
    const session = await this.prisma.auditSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${sessionId} not found`);
    }

    if (
      session.status === 'COMPLETED' ||
      session.status === 'SUBMITTED' ||
      session.status === 'REVIEWED'
    ) {
      throw new BadRequestException(
        `Audit session is ${session.status} and locked for scanning. Reopen session to scan additional items.`,
      );
    }

    if (session.status === 'NOT_STARTED') {
      await this.prisma.auditSession.update({
        where: { id: session.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
    }

    if (session.planId) {
      const parentPlan = await this.prisma.auditPlan.findUnique({ where: { id: session.planId } });
      if (
        parentPlan &&
        (parentPlan.status === 'DRAFT' ||
          parentPlan.status === 'SCHEDULED' ||
          parentPlan.status === 'PUBLISHED')
      ) {
        await this.prisma.auditPlan.update({
          where: { id: session.planId },
          data: { status: 'IN_PROGRESS' },
        });
      }
    }

    // Normalize status (treat FOUND as VERIFIED)
    const normalizedStatus =
      dto.status === 'FOUND' ? 'VERIFIED' : dto.status;

    // Find or create the AuditItem for this session + asset.
    let auditItem = await this.prisma.auditItem.findFirst({
      where: { sessionId, assetId: dto.assetId },
      include: { asset: { select: { assetCode: true, name: true } } },
    });

    const isDamaged = dto.condition === 'DAMAGED' || dto.status === 'DAMAGED';

    // Prevent duplicate scan in the same session
    if (auditItem && auditItem.status !== 'PENDING' && auditItem.scannedAt !== null) {
      throw new ConflictException(
        `Duplicate scan rejected: Asset "${auditItem.asset?.assetCode || dto.assetId}" (${auditItem.asset?.name || ''}) has ALREADY been audited in this session at ${auditItem.scannedAt.toLocaleTimeString()}. Duplicate scans are not allowed.`,
      );
    }

    // Prevent duplicate scan across sessions in the same audit plan
    if (session.planId) {
      const existingInPlan = await this.prisma.auditItem.findFirst({
        where: {
          assetId: dto.assetId,
          sessionId: { not: sessionId },
          session: { planId: session.planId },
          status: { in: ['VERIFIED', 'FOUND', 'DAMAGED', 'MISMATCH'] },
          scannedAt: { not: null },
        },
        include: {
          session: { include: { location: { select: { name: true, code: true } } } },
          asset: { select: { assetCode: true, name: true } },
        },
      });

      if (existingInPlan) {
        throw new ConflictException(
          `Duplicate scan rejected: Asset "${existingInPlan.asset?.assetCode || dto.assetId}" (${existingInPlan.asset?.name || ''}) was ALREADY audited in this audit plan (Station: ${existingInPlan.session?.location?.name || 'another station'}). Duplicate scans are not allowed.`,
        );
      }

      // Cross-Session Auto-Reconciliation:
      // If this asset was previously marked MISSING in another session of this plan:
      const missingInPlan = await this.prisma.auditItem.findFirst({
        where: {
          assetId: dto.assetId,
          sessionId: { not: sessionId },
          session: { planId: session.planId },
          status: 'MISSING',
        },
        include: { discrepancy: true },
      });

      if (missingInPlan) {
        await this.prisma.auditItem.update({
          where: { id: missingInPlan.id },
          data: {
            notes: `Relocated: Found & scanned at session ${session.id}`,
          },
        });
        if (missingInPlan.discrepancy && !missingInPlan.discrepancy.resolvedAt) {
          await this.prisma.auditDiscrepancy.update({
            where: { id: missingInPlan.discrepancy.id },
            data: {
              resolvedAt: new Date(),
              resolutionNotes: `Auto-resolved: Physically found and audited at another station in session ${session.id}`,
            },
          });
        }
      }
    }

    const targetLocationId = dto.foundLocationId || session.locationId;
    const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
    const expectedLocationId = auditItem?.expectedLocationId || asset?.locationId;
    const isLocationMismatch = Boolean(
      expectedLocationId && targetLocationId && expectedLocationId !== targetLocationId,
    );

    const finalStatus = isDamaged
      ? 'DAMAGED'
      : isLocationMismatch
        ? 'MISMATCH'
        : 'VERIFIED';

    let finalItem: any;

    if (!auditItem) {
      finalItem = await this.prisma.auditItem.create({
        data: {
          sessionId,
          assetId: dto.assetId,
          expectedLocationId,
          foundLocationId: targetLocationId,
          status: finalStatus,
          condition: dto.condition,
          notes: dto.notes,
          scannedAt: new Date(),
        },
      });
    } else {
      finalItem = await this.prisma.auditItem.update({
        where: { id: auditItem.id },
        data: {
          status: finalStatus,
          condition: dto.condition || auditItem.condition,
          notes: dto.notes || auditItem.notes,
          foundLocationId: targetLocationId || auditItem.expectedLocationId,
          photoPath: dto.photoPath,
          scannedAt: new Date(),
        },
      });
    }

    // Create or update discrepancy record if the item is DAMAGED or LOCATION_MISMATCH
    const discrepancyType = isDamaged
      ? 'DAMAGED'
      : isLocationMismatch
        ? 'LOCATION_MISMATCH'
        : null;

    if (discrepancyType) {
      const existingDiscrepancy = await this.prisma.auditDiscrepancy.findFirst({
        where: { auditItemId: finalItem.id },
      });

      if (!existingDiscrepancy) {
        await this.prisma.auditDiscrepancy.create({
          data: {
            sessionId,
            assetId: dto.assetId,
            auditItemId: finalItem.id,
            discrepancyType,
            description: dto.notes || `Discrepancy noted: ${discrepancyType}`,
          },
        });
      } else {
        await this.prisma.auditDiscrepancy.update({
          where: { id: existingDiscrepancy.id },
          data: {
            discrepancyType,
            description: dto.notes || `Discrepancy updated: ${discrepancyType}`,
          },
        });
      }
    } else {
      await this.prisma.auditDiscrepancy.deleteMany({
        where: { auditItemId: finalItem.id },
      });
    }

    this.invalidateSessionsCache();

    return finalItem;
  }

  async commitLocationBatch(
    planId: string,
    dto: CommitLocationBatchDto,
    createdById: string,
  ) {
    const plan = await this.findOnePlan(planId);

    // Verify location exists
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException(`Location with id ${dto.locationId} not found`);
    }

    // Resolve valid auditor ID
    let auditorId = dto.auditorId || createdById;
    if (!auditorId || auditorId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) auditorId = admin.id;
    }

    // Find or create active session for this plan + location
    let session = await this.prisma.auditSession.findFirst({
      where: {
        planId,
        locationId: dto.locationId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (
      session &&
      (session.status === 'COMPLETED' ||
        session.status === 'SUBMITTED' ||
        session.status === 'REVIEWED')
    ) {
      throw new BadRequestException(
        `Station session at ${location.name} is already ${session.status} and locked for scanning. Reopen the session in the audit plan to scan additional assets.`,
      );
    }

    if (!session) {
      session = await this.prisma.auditSession.create({
        data: {
          planId,
          auditorId,
          locationId: dto.locationId,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          notes: `Floor audit batch scan at ${location.name} (${location.code})`,
        },
      });
    } else if (session.status !== 'IN_PROGRESS') {
      session = await this.prisma.auditSession.update({
        where: { id: session.id },
        data: { status: 'IN_PROGRESS', startedAt: session.startedAt || new Date() },
      });
    }

    // Update plan status to IN_PROGRESS if DRAFT or SCHEDULED
    if (plan.status === 'DRAFT' || plan.status === 'SCHEDULED') {
      await this.prisma.auditPlan.update({
        where: { id: plan.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    let discrepanciesCreated = 0;
    const committedItems = [];

    // Deduplicate any repeated assetIds in the submitted payload
    const seenAssetIds = new Set<string>();
    const uniqueItems = [];
    for (const it of dto.items) {
      if (!seenAssetIds.has(it.assetId)) {
        seenAssetIds.add(it.assetId);
        uniqueItems.push(it);
      }
    }

    for (const itemDto of uniqueItems) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: itemDto.assetId },
        select: { id: true, locationId: true, name: true, assetCode: true },
      });
      if (!asset) continue;

      // Find or check existing AuditItem in this session
      let auditItem = await this.prisma.auditItem.findFirst({
        where: { sessionId: session.id, assetId: asset.id },
      });

      // Reject/skip already audited items to prevent duplicate records
      if (auditItem && auditItem.status !== 'PENDING' && auditItem.scannedAt !== null) {
        continue;
      }

      const expectedLocationId = asset.locationId;
      const isLocationMismatch = Boolean(
        expectedLocationId && expectedLocationId !== dto.locationId,
      );
      const isDamaged = itemDto.condition === 'DAMAGED';

      const finalStatus = isDamaged
        ? 'DAMAGED'
        : isLocationMismatch
          ? 'MISMATCH'
          : 'VERIFIED';

      if (!auditItem) {
        auditItem = await this.prisma.auditItem.create({
          data: {
            sessionId: session.id,
            assetId: asset.id,
            expectedLocationId,
            foundLocationId: dto.locationId,
            status: finalStatus,
            condition: itemDto.condition || 'GOOD',
            notes: itemDto.notes,
            scannedAt: new Date(),
          },
        });
      } else {
        auditItem = await this.prisma.auditItem.update({
          where: { id: auditItem.id },
          data: {
            foundLocationId: dto.locationId,
            status: finalStatus,
            condition: itemDto.condition || 'GOOD',
            notes: itemDto.notes,
            scannedAt: new Date(),
          },
        });
      }

      // Check for discrepancies
      const discrepancyType = isDamaged
        ? 'DAMAGED'
        : isLocationMismatch
          ? 'LOCATION_MISMATCH'
          : null;

      if (discrepancyType) {
        const existingDisc = await this.prisma.auditDiscrepancy.findFirst({
          where: { auditItemId: auditItem.id },
        });

        if (!existingDisc) {
          await this.prisma.auditDiscrepancy.create({
            data: {
              sessionId: session.id,
              assetId: asset.id,
              auditItemId: auditItem.id,
              discrepancyType,
              description:
                discrepancyType === 'LOCATION_MISMATCH'
                  ? `Asset ${asset.assetCode} physically found stationed at ${location.name} (${location.code})`
                  : `Asset ${asset.assetCode} scanned with damaged condition`,
            },
          });
          discrepanciesCreated++;
        }
      }

      committedItems.push(auditItem);
    }

    this.invalidateSessionsCache();
    return {
      success: true,
      sessionId: session.id,
      location: {
        id: location.id,
        name: location.name,
        code: location.code,
      },
      committedCount: committedItems.length,
      discrepanciesCount: discrepanciesCreated,
    };
  }

  async submitSession(id: string, auditorId: string) {
    const session = await this.prisma.auditSession.findUnique({ where: { id } });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
    }

    this.invalidateSessionsCache();
    return this.prisma.auditSession.update({
      where: { id },
      data: { status: 'COMPLETED', submittedAt: new Date() },
    });
  }

  async completeSession(id: string, userId?: string, markUnscannedAsMissing: boolean = false) {
    const session = await this.prisma.auditSession.findUnique({
      where: { id },
      include: { plan: true, location: true },
    });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
    }

    if (markUnscannedAsMissing) {
      await this.markUnscannedItemsAsMissing(id, userId);
    }

    const updatedSession = await this.prisma.auditSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        submittedAt: session.submittedAt || new Date(),
      },
    });

    // Check if all sessions for this plan are completed
    const allSessions = await this.prisma.auditSession.findMany({
      where: { planId: session.planId },
    });
    const allCompleted = allSessions.every((s) => s.status === 'COMPLETED');
    if (allCompleted && allSessions.length > 0) {
      await this.prisma.auditPlan.update({
        where: { id: session.planId },
        data: { status: 'COMPLETED' },
      });
    }

    this.invalidateSessionsCache();
    return updatedSession;
  }

  async markUnscannedItemsAsMissing(sessionId: string, userId?: string) {
    const session = await this.prisma.auditSession.findUnique({
      where: { id: sessionId },
      include: { location: true },
    });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const pendingItems = await this.prisma.auditItem.findMany({
      where: { sessionId, status: 'PENDING' },
      include: { asset: true },
    });

    if (pendingItems.length === 0) return { count: 0 };

    for (const item of pendingItems) {
      await this.prisma.auditItem.update({
        where: { id: item.id },
        data: {
          status: 'MISSING',
          notes: item.notes
            ? `${item.notes} | Marked MISSING during session completion`
            : 'Marked MISSING during session completion',
        },
      });

      const existingDiscrepancy = await this.prisma.auditDiscrepancy.findUnique({
        where: { auditItemId: item.id },
      });

      if (!existingDiscrepancy) {
        await this.prisma.auditDiscrepancy.create({
          data: {
            sessionId,
            assetId: item.assetId,
            auditItemId: item.id,
            discrepancyType: 'MISSING',
            description: `Asset "${item.asset?.assetCode || item.assetId}" expected at ${session.location?.name || 'station'} was not found during floor audit`,
          },
        });
      }
    }

    this.invalidateSessionsCache();
    return { count: pendingItems.length };
  }

  async markPlanUnscannedAsMissing(planId: string, userId?: string) {
    const sessions = await this.prisma.auditSession.findMany({
      where: { planId },
      select: { id: true },
    });
    let totalCount = 0;
    for (const session of sessions) {
      const res = await this.markUnscannedItemsAsMissing(session.id, userId);
      totalCount += res.count;
    }
    return { count: totalCount };
  }

  async markItemMissing(itemId: string, userId?: string, notes?: string) {
    const item = await this.prisma.auditItem.findUnique({
      where: { id: itemId },
      include: { session: { include: { location: true } }, asset: true },
    });
    if (!item) {
      throw new NotFoundException(`Audit item ${itemId} not found`);
    }

    await this.prisma.auditItem.update({
      where: { id: itemId },
      data: {
        status: 'MISSING',
        notes: notes || item.notes || 'Manually marked as MISSING by auditor during floor inspection',
      },
    });

    const existingDiscrepancy = await this.prisma.auditDiscrepancy.findUnique({
      where: { auditItemId: itemId },
    });

    if (!existingDiscrepancy) {
      await this.prisma.auditDiscrepancy.create({
        data: {
          sessionId: item.sessionId,
          assetId: item.assetId,
          auditItemId: item.id,
          discrepancyType: 'MISSING',
          description: `Asset "${item.asset?.assetCode || item.assetId}" manually flagged as MISSING at ${item.session?.location?.name || 'station'}`,
        },
      });
    }

    this.invalidateSessionsCache();
    return { success: true };
  }

  async reopenSession(id: string) {
    const session = await this.prisma.auditSession.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
    }

    this.invalidateSessionsCache();
    const updated = await this.prisma.auditSession.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });

    // Also reopen parent plan to IN_PROGRESS
    await this.prisma.auditPlan.update({
      where: { id: session.planId },
      data: { status: 'IN_PROGRESS' },
    });

    return updated;
  }

  async reviewSession(id: string, reviewedById: string) {
    const session = await this.prisma.auditSession.findUnique({ where: { id } });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
    }

    if (session.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Session can only be reviewed when status is SUBMITTED. Current: ${session.status}`,
      );
    }

    return this.prisma.auditSession.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        reviewedAt: new Date(),
        reviewedById,
      },
    });
  }

  async findSessionItems(sessionId: string) {
    const session = await this.prisma.auditSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${sessionId} not found`);
    }

    return this.prisma.auditItem.findMany({
      where: { sessionId },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            assetCode: true,
            sapAssetCode: true,
            serialNumber: true,
            model: true,
            qrCode: true,
          },
        },
        expectedLocation: { select: { id: true, name: true, code: true } },
        foundLocation: { select: { id: true, name: true, code: true } },
        discrepancy: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveDiscrepancy(
    id: string,
    dto: ResolveDiscrepancyDto,
    resolvedById: string,
  ) {
    const discrepancy = await this.prisma.auditDiscrepancy.findUnique({
      where: { id },
      include: { auditItem: { include: { asset: true } } },
    });

    if (!discrepancy) {
      throw new NotFoundException(`Discrepancy with id ${id} not found`);
    }

    if (discrepancy.resolvedAt) {
      throw new BadRequestException('This discrepancy has already been resolved');
    }

    let validUserId = resolvedById;
    if (!validUserId || validUserId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) validUserId = admin.id;
    }

    // If this is a MISSING discrepancy and manager approved marking asset as LOST:
    const shouldMarkAsLost =
      discrepancy.discrepancyType === 'MISSING' &&
      (dto.markAssetAsLost === true || dto.action === 'MARK_LOST');

    const asset =
      discrepancy.auditItem?.asset ||
      (await this.prisma.asset.findUnique({ where: { id: discrepancy.assetId } }));

    if (shouldMarkAsLost && asset) {
      // 1. Update Master Asset status to LOST
      await this.prisma.asset.update({
        where: { id: discrepancy.assetId },
        data: { status: 'LOST' },
      });

      // 2. Record status change in AssetStatusHistory
      if (validUserId) {
        await this.prisma.assetStatusHistory.create({
          data: {
            assetId: discrepancy.assetId,
            oldStatus: asset.status,
            newStatus: 'LOST',
            changedById: validUserId,
            reason: dto.resolutionNotes || 'Confirmed missing by manager review after inventory audit',
          },
        });
      }
    }

    const updated = await this.prisma.auditDiscrepancy.update({
      where: { id },
      data: {
        resolvedById: validUserId,
        resolvedAt: new Date(),
        resolutionNotes: dto.resolutionNotes,
      },
    });

    this.invalidateSessionsCache();
    return updated;
  }

  /**
   * Terminal Quick-Scan / Offline Outbox Sync.
   * Records floor audit scans from mobile terminals into the database.
   */
  async quickScan(dto: QuickScanDto, userId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        OR: [{ id: dto.assetId }, { assetCode: dto.assetId }],
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${dto.assetId} not found`);
    }

    let auditorId = userId;
    let validAuditorId = auditorId;
    if (!validAuditorId || validAuditorId === 'admin') {
      const admin = await this.prisma.user.findFirst({ select: { id: true } });
      if (admin) validAuditorId = admin.id;
    }

    const auditedAt = dto.auditedAt ? new Date(dto.auditedAt) : new Date();

    const updateData: any = {};
    if (dto.status === 'DAMAGED') {
      updateData.condition = 'DAMAGED';
    } else if (dto.status === 'FOUND' && (!asset.condition || asset.condition === 'DAMAGED')) {
      updateData.condition = 'GOOD';
    }
    if (dto.verifiedLocationId && dto.status !== 'LOCATION_MISMATCH') {
      updateData.locationId = dto.verifiedLocationId;
    }
    if (validAuditorId) {
      updateData.updatedById = validAuditorId;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.asset.update({
        where: { id: asset.id },
        data: updateData,
      });
    }

    // Resolve Audit Session
    let session: any = null;

    if (dto.sessionId) {
      session = await this.prisma.auditSession.findUnique({
        where: { id: dto.sessionId },
      });
    }

    if (!session) {
      // Find active, published or scheduled plan
      const planWhere: any = dto.planId
        ? { id: dto.planId }
        : { status: { in: ['IN_PROGRESS', 'PUBLISHED', 'SCHEDULED', 'DRAFT'] } };

      const targetPlan = await this.prisma.auditPlan.findFirst({
        where: planWhere,
        orderBy: { createdAt: 'desc' },
      });

      if (targetPlan) {
        const targetLocationId = dto.verifiedLocationId || asset.locationId;
        if (targetLocationId) {
          session = await this.prisma.auditSession.findFirst({
            where: { planId: targetPlan.id, locationId: targetLocationId },
            orderBy: { createdAt: 'desc' },
          });

          if (!session && validAuditorId) {
            session = await this.prisma.auditSession.create({
              data: {
                planId: targetPlan.id,
                locationId: targetLocationId,
                auditorId: validAuditorId,
                status: 'IN_PROGRESS',
                startedAt: auditedAt,
              },
            });
          }
        }

        // Fallback: check for any existing session in this plan
        if (!session) {
          session = await this.prisma.auditSession.findFirst({
            where: { planId: targetPlan.id },
            orderBy: { createdAt: 'desc' },
          });
        }
      }
    }

    if (session) {
      // If session was NOT_STARTED, transition to IN_PROGRESS
      if (session.status === 'NOT_STARTED') {
        await this.prisma.auditSession.update({
          where: { id: session.id },
          data: { status: 'IN_PROGRESS', startedAt: auditedAt },
        });
      }

      // If parent plan was DRAFT, SCHEDULED, or PUBLISHED, transition to IN_PROGRESS
      if (session.planId) {
        const parentPlan = await this.prisma.auditPlan.findUnique({ where: { id: session.planId } });
        if (
          parentPlan &&
          (parentPlan.status === 'DRAFT' ||
            parentPlan.status === 'SCHEDULED' ||
            parentPlan.status === 'PUBLISHED')
        ) {
          await this.prisma.auditPlan.update({
            where: { id: session.planId },
            data: { status: 'IN_PROGRESS' },
          });
        }
      }

      const targetLocationId = dto.verifiedLocationId || session.locationId || asset.locationId;
      const isDamaged = dto.status === 'DAMAGED';
      const isLocationMismatch = Boolean(
        asset.locationId && targetLocationId && asset.locationId !== targetLocationId,
      );

      const finalStatus = isDamaged
        ? 'DAMAGED'
        : isLocationMismatch
          ? 'MISMATCH'
          : 'VERIFIED';

      const auditItem = await this.prisma.auditItem.upsert({
        where: {
          sessionId_assetId: {
            sessionId: session.id,
            assetId: asset.id,
          },
        },
        update: {
          status: finalStatus,
          condition: updateData.condition || asset.condition || 'GOOD',
          scannedAt: auditedAt,
          notes: dto.notes,
          foundLocationId: targetLocationId,
        },
        create: {
          sessionId: session.id,
          assetId: asset.id,
          expectedLocationId: asset.locationId,
          foundLocationId: targetLocationId,
          status: finalStatus,
          condition: updateData.condition || asset.condition || 'GOOD',
          scannedAt: auditedAt,
          notes: dto.notes,
        },
      });

      // Handle discrepancy
      const discrepancyType = isDamaged
        ? 'DAMAGED'
        : isLocationMismatch
          ? 'LOCATION_MISMATCH'
          : null;

      if (discrepancyType) {
        const existingDisc = await this.prisma.auditDiscrepancy.findFirst({
          where: { auditItemId: auditItem.id },
        });

        if (!existingDisc) {
          await this.prisma.auditDiscrepancy.create({
            data: {
              sessionId: session.id,
              assetId: asset.id,
              auditItemId: auditItem.id,
              discrepancyType,
              description:
                discrepancyType === 'LOCATION_MISMATCH'
                  ? `Asset ${asset.assetCode} physically scanned at location ${targetLocationId}`
                  : `Asset ${asset.assetCode} scanned with damaged condition`,
            },
          });
        }
      }
    }

    return {
      success: true,
      message: `Asset ${asset.assetCode} audited as ${dto.status}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      status: dto.status,
      sessionId: session?.id,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /** Extract the SCOPE_TYPE embedded in a plan's description field. */
  private _parseScopeType(description: string): string | null {
    const match = description.match(/^\[SCOPE_TYPE:([A-Z_]+)\]/);
    return match ? match[1] : null;
  }

  /** Strip the SCOPE_TYPE prefix from a plan's description field. */
  private _parseRawDescription(description: string): string {
    return description.replace(/^\[SCOPE_TYPE:[A-Z_]+\]\s*/, '');
  }
}
