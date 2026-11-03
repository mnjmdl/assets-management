import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
  constructor(private readonly prisma: PrismaService) {}

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
      } catch {}
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
    });

    if (!auditItem) {
      const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
      auditItem = await this.prisma.auditItem.create({
        data: {
          sessionId,
          assetId: dto.assetId,
          expectedLocationId: asset?.locationId,
          foundLocationId: dto.foundLocationId || session.locationId || asset?.locationId,
          status: normalizedStatus,
          condition: dto.condition,
          notes: dto.notes,
          scannedAt: new Date(),
        },
      });
    } else {
      auditItem = await this.prisma.auditItem.update({
        where: { id: auditItem.id },
        data: {
          status: normalizedStatus,
          condition: dto.condition,
          notes: dto.notes,
          foundLocationId: dto.foundLocationId || session.locationId || auditItem.expectedLocationId,
          photoPath: dto.photoPath,
          scannedAt: new Date(),
        },
      });
    }

    // Create discrepancy record if the item is MISSING, DAMAGED, or LOCATION_MISMATCH
    const isLocationMismatch =
      auditItem.expectedLocationId &&
      dto.foundLocationId &&
      auditItem.expectedLocationId !== dto.foundLocationId;

    const discrepancyType =
      dto.status === 'MISSING'
        ? 'MISSING'
        : dto.status === 'DAMAGED'
        ? 'DAMAGED'
        : isLocationMismatch
        ? 'LOCATION_MISMATCH'
        : null;

    if (discrepancyType) {
      const existingDiscrepancy = await this.prisma.auditDiscrepancy.findFirst({
        where: { auditItemId: auditItem.id },
      });

      if (!existingDiscrepancy) {
        await this.prisma.auditDiscrepancy.create({
          data: {
            sessionId,
            assetId: dto.assetId,
            auditItemId: auditItem.id,
            discrepancyType,
          },
        });
      }
    }

    return auditItem;
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

    for (const itemDto of dto.items) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: itemDto.assetId },
        select: { id: true, locationId: true, name: true, assetCode: true },
      });
      if (!asset) continue;

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

      // Find or create AuditItem
      let auditItem = await this.prisma.auditItem.findFirst({
        where: { sessionId: session.id, assetId: asset.id },
      });

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

  async completeSession(id: string, userId?: string) {
    const session = await this.prisma.auditSession.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!session) {
      throw new NotFoundException(`Audit session with id ${id} not found`);
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
    });

    if (!discrepancy) {
      throw new NotFoundException(`Discrepancy with id ${id} not found`);
    }

    if (discrepancy.resolvedAt) {
      throw new BadRequestException('This discrepancy has already been resolved');
    }

    return this.prisma.auditDiscrepancy.update({
      where: { id },
      data: {
        resolvedById,
        resolvedAt: new Date(),
        resolutionNotes: dto.resolutionNotes,
      },
    });
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

      const auditItem = await this.prisma.auditItem.upsert({
        where: {
          sessionId_assetId: {
            sessionId: session.id,
            assetId: asset.id,
          },
        },
        update: {
          status: isDamaged ? 'DAMAGED' : 'VERIFIED',
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
          status: isDamaged ? 'DAMAGED' : 'VERIFIED',
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
