import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { bcrypt } from '../common/utils/bcrypt.util';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateUserDto, UpdateUserStatusDto } from './dto/create-user.dto';

const DEFAULT_SETTINGS: Record<string, { value: string; description: string }> = {
  company_name: { value: 'CMBD Enterprise / ABL Group', description: 'Organization / Company legal name' },
  company_code: { value: 'CMBD', description: 'Enterprise short code' },
  currency: { value: 'USD ($)', description: 'Default system currency display symbol' },
  timezone: { value: 'Asia/Dhaka', description: 'Primary timezone for timestamps and audits' },
  fiscal_year_start: { value: 'July', description: 'Start month of company financial year' },
  contact_email: { value: 'admin@assets.com', description: 'System administrator contact email' },
  contact_phone: { value: '+880 1700-000000', description: 'Facility operations support phone' },
  asset_prefix: { value: 'AST-', description: 'Auto-generated asset tag identifier prefix' },
  barcode_format: { value: 'AST:{assetCode}', description: 'QR / Barcode content pattern' },
  default_depreciation: { value: 'STRAIGHT_LINE', description: 'Standard asset valuation depreciation method' },
  require_serial_number: { value: 'false', description: 'Enforce serial number mandatory validation on creation' },
  auto_calc_depreciation: { value: 'true', description: 'Automatically compute current book value in reports' },
  audit_batch_size: { value: '1000', description: 'Audit session asset population chunk size' },
  audit_default_scope: { value: 'LOCATION', description: 'Default scope when initiating new audit plans' },
  allow_cross_location_scan: { value: 'false', description: 'Permit scanning assets assigned to different parent hierarchies' },
  audit_require_reviewer: { value: 'true', description: 'Require managerial sign-off before closing audit plan' },
  auto_flag_discrepancies: { value: 'true', description: 'Automatically flag missing or mismatched location scans' },
  warranty_alert_days: { value: '30', description: 'Days before warranty expiration to trigger notification' },
  maintenance_alert_days: { value: '7', description: 'Days before scheduled maintenance to alert technician' },
  auto_maintenance_reminders: { value: 'true', description: 'Generate automated in-app maintenance reminders' },
  email_alerts_enabled: { value: 'true', description: 'Dispatch critical discrepancy emails to asset managers' },
  audit_trail_retention_days: { value: '365', description: 'Days to retain audit logs in database' },
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── System Settings ────────────────────────────────────────────────────────

  async getSettings(): Promise<Record<string, string>> {
    const existing = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};

    existing.forEach((item) => {
      map[item.key] = item.value;
    });

    // Seed missing default settings into database
    const toSeed: { key: string; value: string; description: string }[] = [];
    for (const [key, meta] of Object.entries(DEFAULT_SETTINGS)) {
      if (map[key] === undefined) {
        map[key] = meta.value;
        toSeed.push({ key, value: meta.value, description: meta.description });
      }
    }

    if (toSeed.length > 0) {
      for (const item of toSeed) {
        await this.prisma.systemSetting.upsert({
          where: { key: item.key },
          update: {},
          create: {
            key: item.key,
            value: item.value,
            description: item.description,
          },
        }).catch(() => {});
      }
    }

    return map;
  }

  async updateSettings(settingsMap: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(settingsMap)) {
      const description = DEFAULT_SETTINGS[key]?.description || 'Custom configuration setting';
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: {
          key,
          value: String(value),
          description,
        },
      });
    }

    return this.getSettings();
  }

  async getStats() {
    const [
      assetsCount,
      activeAssetsCount,
      categoriesCount,
      locationsCount,
      auditsCount,
      sessionsCount,
      usersCount,
      maintenanceCount,
      vendorsCount,
    ] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { isActive: true } }),
      this.prisma.assetCategory.count(),
      this.prisma.location.count(),
      this.prisma.auditPlan.count(),
      this.prisma.auditSession.count(),
      this.prisma.user.count(),
      this.prisma.maintenanceRecord.count(),
      this.prisma.vendor.count(),
    ]);

    return {
      assetsCount,
      activeAssetsCount,
      categoriesCount,
      locationsCount,
      auditsCount,
      sessionsCount,
      usersCount,
      maintenanceCount,
      vendorsCount,
      dbStatus: 'HEALTHY',
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  // ─── Categories Management ──────────────────────────────────────────────────

  async getCategories() {
    return this.prisma.assetCategory.findMany({
      include: {
        _count: { select: { assets: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.assetCategory.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Category with code "${dto.code}" already exists`);
    }

    return this.prisma.assetCategory.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        _count: { select: { assets: true } },
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!cat) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    if (dto.code && dto.code !== cat.code) {
      const existing = await this.prisma.assetCategory.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new BadRequestException(`Category with code "${dto.code}" already exists`);
      }
    }

    return this.prisma.assetCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        _count: { select: { assets: true } },
      },
    });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.assetCategory.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!cat) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    if (cat._count.assets > 0) {
      throw new BadRequestException(
        `Cannot delete category "${cat.name}" because it is assigned to ${cat._count.assets} asset(s). Deactivate it instead.`,
      );
    }

    await this.prisma.assetCategory.delete({ where: { id } });
    return { success: true, message: `Category "${cat.name}" deleted successfully` };
  }

  // ─── Users Management ───────────────────────────────────────────────────────

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            assignedAssets: true,
            auditSessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new BadRequestException(`User with email "${dto.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        role: dto.role || 'EMPLOYEE',
        phone: dto.phone,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateUser(id: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    if (dto.email && dto.email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      const emailNormalized = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({
        where: { email: emailNormalized },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`User with email "${dto.email}" already exists`);
      }
    }

    let passwordHash: string | undefined;
    if (dto.password && dto.password.trim().length > 0) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase().trim() } : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}

