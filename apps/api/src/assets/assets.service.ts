import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { AssetFilterDto } from './dto/asset-filter.dto';
import * as QRCode from 'qrcode';
import { Prisma } from '@repo/database';
import * as ExcelJS from 'exceljs';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) { }

  // ── Asset Code Generator ────────────────────────────────────────────────────
  private async generateAssetCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.asset.count();
    return `AST-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async create(dto: CreateAssetDto, createdById: string) {
    const assetCode = await this.generateAssetCode();
    const qrCode = dto.sapAssetCode || assetCode; // QR code scan data is SAP Code

    return this.prisma.asset.create({
      data: {
        ...dto,
        assetCode,
        qrCode,
        createdById,
        purchaseCost: dto.purchaseCost ? new Prisma.Decimal(dto.purchaseCost) : undefined,
        currentValue: dto.purchaseCost ? new Prisma.Decimal(dto.purchaseCost) : undefined,
        depreciationRate: dto.depreciationRate ? new Prisma.Decimal(dto.depreciationRate) : undefined,
        customFields: dto.customFields ? JSON.stringify(dto.customFields) : undefined,
      },
      include: { category: true, location: true, department: true, vendor: true },
    });
  }

  private async _resolveLocationAndDescendantIds(locationId: string): Promise<string[]> {
    const allLocs = await this.prisma.location.findMany({ select: { id: true, parentId: true } });
    const locIds = new Set<string>([locationId]);
    let added = true;
    while (added) {
      added = false;
      for (const loc of allLocs) {
        if (loc.parentId && locIds.has(loc.parentId) && !locIds.has(loc.id)) {
          locIds.add(loc.id);
          added = true;
        }
      }
    }
    return Array.from(locIds);
  }

  // ── Find All (with pagination & filters) ───────────────────────────────────
  async findAll(filter: AssetFilterDto) {
    const {
      page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc',
      status, categoryId, locationId, departmentId, vendorId,
      warrantyExpiryBefore, purchaseDateFrom, purchaseDateTo, sapAssetCode,
    } = filter;

    const matchedLocationIds = locationId
      ? await this._resolveLocationAndDescendantIds(locationId)
      : null;

    const where: Prisma.AssetWhereInput = {
      isActive: true,
      ...(sapAssetCode && { sapAssetCode }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { assetCode: { contains: search } },
          { sapAssetCode: { contains: search } },
          { serialNumber: { contains: search } },
          { model: { contains: search } },
        ],
      }),
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(matchedLocationIds && { locationId: { in: matchedLocationIds } }),
      ...(departmentId && { departmentId }),
      ...(vendorId && { vendorId }),
      ...(warrantyExpiryBefore && { warrantyExpiry: { lte: warrantyExpiryBefore } }),
      ...(purchaseDateFrom && purchaseDateTo && {
        purchaseDate: { gte: purchaseDateFrom, lte: purchaseDateTo },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          photos: { where: { isPrimary: true }, take: 1 },
        },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      data,
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

  // ── Export to Excel ──────────────────────────────────────────────────────────
  async exportExcel(filter: AssetFilterDto): Promise<Buffer> {
    const {
      search, sortBy = 'createdAt', sortOrder = 'desc',
      status, categoryId, locationId, departmentId, vendorId,
      warrantyExpiryBefore, purchaseDateFrom, purchaseDateTo, sapAssetCode,
    } = filter;

    const matchedLocationIds = locationId
      ? await this._resolveLocationAndDescendantIds(locationId)
      : null;

    const where: Prisma.AssetWhereInput = {
      isActive: true,
      ...(sapAssetCode && { sapAssetCode }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { assetCode: { contains: search } },
          { sapAssetCode: { contains: search } },
          { serialNumber: { contains: search } },
          { model: { contains: search } },
        ],
      }),
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(matchedLocationIds && { locationId: { in: matchedLocationIds } }),
      ...(departmentId && { departmentId }),
      ...(vendorId && { vendorId }),
      ...(warrantyExpiryBefore && { warrantyExpiry: { lte: warrantyExpiryBefore } }),
      ...(purchaseDateFrom && purchaseDateTo && {
        purchaseDate: { gte: purchaseDateFrom, lte: purchaseDateTo },
      }),
    };

    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: true,
        location: {
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
          },
        },
        department: true,
        vendor: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Assets Management System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Assets Inventory', {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { orientation: 'landscape', paperSize: 9 },
    });

    sheet.columns = [
      { header: 'SL No.', key: 'sl', width: 8 },
      { header: 'Asset Class', key: 'assetClass', width: 14 },
      { header: 'Category', key: 'category', width: 24 },
      { header: 'Asset No (SAP)', key: 'sapAssetCode', width: 18 },
      { header: 'Tagging ID', key: 'assetCode', width: 22 },
      { header: 'Asset Description', key: 'name', width: 35 },
      { header: 'Capitalized Date', key: 'purchaseDate', width: 16 },
      { header: 'Book Cost (BDT)', key: 'purchaseCost', width: 18 },
      { header: 'Location Hierarchy', key: 'location', width: 30 },
      { header: 'Station Code', key: 'stationCode', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Model / Serial', key: 'modelSerial', width: 22 },
    ];

    // Style the header row
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const formatLocation = (loc: any) => {
      if (!loc) return 'Apex ABL Manufacturing';
      const parts: string[] = [];
      let curr = loc;
      while (curr) {
        parts.unshift(curr.name || curr.code);
        curr = curr.parent;
      }
      return parts.join(' > ');
    };

    assets.forEach((item, idx) => {
      const row = sheet.addRow({
        sl: idx + 1,
        assetClass: item.category?.code || '—',
        category: item.category?.name || 'General Asset',
        sapAssetCode: item.sapAssetCode || '—',
        assetCode: item.assetCode,
        name: item.name,
        purchaseDate: item.purchaseDate
          ? new Date(item.purchaseDate).toISOString().slice(0, 10)
          : '—',
        purchaseCost: item.purchaseCost ? Number(item.purchaseCost) : 0,
        location: formatLocation(item.location),
        stationCode: item.location?.code || '—',
        status: item.status,
        modelSerial: [item.model, item.serialNumber].filter(Boolean).join(' / ') || '—',
      });

      row.height = 22;
      row.alignment = { vertical: 'middle' };
      row.font = { name: 'Arial', size: 9 };

      const costCell = row.getCell('purchaseCost');
      costCell.numFmt = '#,##0.00';
      costCell.alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell('sl').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('sapAssetCode').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('assetCode').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('purchaseDate').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('status').alignment = { vertical: 'middle', horizontal: 'center' };

      if (idx % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── Find One ────────────────────────────────────────────────────────────────
  async findOne(idOrCode: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { assetCode: idOrCode },
          { sapAssetCode: idOrCode },
          { qrCode: idOrCode },
        ],
      },
      include: {
        category: true,
        location: {
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
          },
        },
        department: true,
        vendor: true,
        photos: true,
        documents: true,
        assignments: {
          where: { isActive: true },
          include: {
            assignedToUser: { select: { id: true, name: true, email: true } },
            assignedToDept: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
          take: 1,
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 10,
          include: { changedBy: { select: { id: true, name: true } } },
        },
        maintenanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!asset) throw new NotFoundException(`Asset '${idOrCode}' not found`);
    return asset;
  }

  // ── Find by Code or QR ──────────────────────────────────────────────────────
  async findByCode(rawCode: string) {
    if (!rawCode) throw new BadRequestException('Scan code cannot be empty');

    let code = rawCode.trim();
    // If a full URL was scanned, extract the identifier
    if (code.includes('/assets/')) {
      const parts = code.split('/assets/')[1]?.split(/[?#]/)[0];
      if (parts) code = decodeURIComponent(parts);
    } else if (code.includes('code=')) {
      const match = code.match(/[?&]code=([^&#]+)/);
      if (match && match[1]) code = decodeURIComponent(match[1]);
    }

    // 1. Try finding an asset
    const asset = await this.prisma.asset.findFirst({
      where: {
        OR: [
          { id: code },
          { assetCode: code },
          { sapAssetCode: code },
          { qrCode: code },
          { barcode: code },
        ],
      },
      include: {
        category: true,
        location: {
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
          },
        },
        department: true,
        vendor: true,
        assignments: {
          where: { isActive: true },
          include: {
            assignedToUser: { select: { id: true, name: true, email: true } },
            assignedToDept: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
    });

    if (asset) {
      return {
        type: 'ASSET',
        asset,
      };
    }

    // 2. If not an asset, check if it's a Location QR placard (Line/Block/Unit/Company)
    const cleanLocCode = code.replace(/^LOC:/i, '').trim();
    const location = await this.prisma.location.findFirst({
      where: {
        OR: [
          { id: code },
          { code: cleanLocCode },
          { qrCode: code },
          { qrCode: `LOC:${cleanLocCode}` },
        ],
      },
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
        assets: {
          where: { isActive: true },
          take: 50,
          include: { category: true },
        },
      },
    });

    if (location) {
      return {
        type: 'LOCATION',
        location,
      };
    }

    throw new NotFoundException(`No asset or location found matching "${rawCode}"`);
  }

  async getFallbackUserId(): Promise<string> {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });
    if (admin) return admin.id;
    const anyUser = await this.prisma.user.findFirst({ select: { id: true } });
    if (anyUser) return anyUser.id;
    return 'cmvxj1mhn0000rjmlqg49y2ju';
  }

  async getReferenceOptions() {
    const [categories, locations, departments, vendors] = await Promise.all([
      this.prisma.assetCategory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.location.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    return { categories, locations, departments, vendors };
  }

  // ── Offline Sync (Lightweight query for fast full 13k+ synchronization) ──
  async getOfflineSyncAssets(updatedSince?: string) {
    const where: Prisma.AssetWhereInput = {
      isActive: true,
      ...(updatedSince ? { updatedAt: { gt: new Date(updatedSince) } } : {}),
    };

    const assets = await this.prisma.asset.findMany({
      where,
      select: {
        id: true,
        assetCode: true,
        sapAssetCode: true,
        name: true,
        model: true,
        serialNumber: true,
        qrCode: true,
        barcode: true,
        status: true,
        condition: true,
        locationId: true,
        categoryId: true,
        updatedAt: true,
        location: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return {
      total: assets.length,
      data: assets.map((a) => ({
        id: a.id,
        assetCode: a.assetCode,
        sapAssetCode: a.sapAssetCode,
        name: a.name,
        model: a.model,
        serialNumber: a.serialNumber,
        qrCode: a.qrCode,
        barcode: a.barcode,
        status: a.status,
        condition: a.condition,
        locationId: a.locationId,
        locationName: a.location?.name || null,
        location: a.location ? { id: a.location.id, name: a.location.name, code: a.location.code } : null,
        categoryId: a.categoryId,
        category: a.category ? { id: a.category.id, name: a.category.name } : null,
        updatedAt: a.updatedAt,
      })),
      syncedAt: new Date().toISOString(),
    };
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateAssetDto, updatedById?: string) {
    const existing = await this.findOne(id); // 404 check
    const effectiveUpdatedById = updatedById || (await this.getFallbackUserId());

    const data: Prisma.AssetUncheckedUpdateInput = {
      ...(dto.name && { name: dto.name }),
      ...(dto.sapAssetCode && { sapAssetCode: dto.sapAssetCode }),
      ...(dto.description !== undefined && { description: dto.description || null }),
      ...(dto.status && { status: dto.status }),
      ...(dto.categoryId && { categoryId: dto.categoryId }),
      ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber || null }),
      ...(dto.model !== undefined && { model: dto.model || null }),
      ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer || null }),
      ...(dto.color !== undefined && { color: dto.color || null }),
      ...(dto.condition !== undefined && { condition: dto.condition || null }),
      ...(dto.notes !== undefined && { notes: dto.notes || null }),
      ...(dto.invoiceNumber !== undefined && { invoiceNumber: dto.invoiceNumber || null }),
      ...(dto.warrantyDetails !== undefined && { warrantyDetails: dto.warrantyDetails || null }),
      ...(dto.depreciationMethod && { depreciationMethod: dto.depreciationMethod }),
      ...(dto.usefulLifeYears !== undefined && {
        usefulLifeYears: dto.usefulLifeYears ? Number(dto.usefulLifeYears) : null,
      }),
      ...(dto.purchaseCost !== undefined && {
        purchaseCost:
          dto.purchaseCost !== null && dto.purchaseCost !== ('' as any)
            ? new Prisma.Decimal(dto.purchaseCost)
            : null,
      }),
      ...(dto.depreciationRate !== undefined && {
        depreciationRate:
          dto.depreciationRate !== null && dto.depreciationRate !== ('' as any)
            ? new Prisma.Decimal(dto.depreciationRate)
            : null,
      }),
      ...(dto.purchaseDate !== undefined && {
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      }),
      ...(dto.warrantyExpiry !== undefined && {
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
      }),
      ...(dto.locationId !== undefined && { locationId: dto.locationId || null }),
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId || null }),
      ...(dto.vendorId !== undefined && { vendorId: dto.vendorId || null }),
      ...(dto.customFields !== undefined && {
        customFields: dto.customFields ? JSON.stringify(dto.customFields) : null,
      }),
      updatedById: effectiveUpdatedById,
    };

    return this.prisma.asset.update({
      where: { id: existing.id },
      data,
      include: {
        category: true,
        location: true,
        department: true,
        vendor: true,
      },
    });
  }

  // ── Update Status ───────────────────────────────────────────────────────────
  async updateStatus(id: string, dto: UpdateAssetStatusDto, changedById: string) {
    const asset = await this.findOne(id);

    await this.prisma.$transaction([
      this.prisma.asset.update({
        where: { id },
        data: { status: dto.status },
      }),
      this.prisma.assetStatusHistory.create({
        data: {
          assetId: id,
          oldStatus: asset.status,
          newStatus: dto.status,
          changedById,
          reason: dto.reason,
          notes: dto.notes,
        },
      }),
    ]);

    return { message: 'Asset status updated successfully' };
  }

  // ── Depreciation Calculation ────────────────────────────────────────────────
  async calculateDepreciation(id: string) {
    const asset = await this.findOne(id);

    if (!asset.purchaseCost || !asset.purchaseDate || !asset.usefulLifeYears) {
      throw new BadRequestException('Asset missing cost, purchase date, or useful life');
    }

    const cost = Number(asset.purchaseCost);
    const years = (Date.now() - asset.purchaseDate.getTime()) / (365.25 * 24 * 3600 * 1000);

    let currentValue: number;
    if (asset.depreciationMethod === 'STRAIGHT_LINE') {
      const annualDep = cost / asset.usefulLifeYears;
      currentValue = Math.max(0, cost - annualDep * years);
    } else if (asset.depreciationMethod === 'DECLINING_BALANCE') {
      const rate = Number(asset.depreciationRate) / 100;
      currentValue = cost * Math.pow(1 - rate, years);
    } else {
      currentValue = cost;
    }

    await this.prisma.asset.update({
      where: { id },
      data: { currentValue: new Prisma.Decimal(currentValue.toFixed(2)) },
    });

    return { currentValue, yearsElapsed: years.toFixed(2) };
  }

  // ── Delete (soft) ───────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.asset.update({ where: { id }, data: { isActive: false } });
    return { message: 'Asset deleted successfully' };
  }

  // ── Add Photos ───────────────────────────────────────────────────────────────
  async addPhotos(id: string, files: Express.Multer.File[]) {
    await this.findOne(id);

    const existingPhotos = await this.prisma.assetPhoto.count({ where: { assetId: id } });

    const photos = await this.prisma.assetPhoto.createMany({
      data: files.map((f, i) => ({
        assetId: id,
        filePath: f.path,
        fileName: f.originalname,
        fileSize: f.size,
        mimeType: f.mimetype,
        isPrimary: existingPhotos === 0 && i === 0,
      })),
    });

    return { message: `${photos.count} photo(s) uploaded` };
  }

  // ── Generate QR ───────────────────────────────────────────────────────────────
  async generateQR(id: string) {
    const asset = await this.findOne(id);
    const qrDataUrl = await QRCode.toDataURL(asset.assetCode, { width: 300 });
    return { assetCode: asset.assetCode, qrDataUrl };
  }

  // ── Preview Excel File (Pre-flight comparison before insertion) ─────────────
  async previewExcel(fileBuffer: Buffer, userId?: string) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (e: any) {
      throw new BadRequestException(`Could not read Excel file: ${e.message}`);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Excel workbook has no worksheets');
    }

    // 1. Detect header row & column indices dynamically
    let headerRowIndex = 3;
    let assetClassCol = 2;
    let categoryCol = 3;
    let sapCodeCol = 4;
    let tagCodeCol = 5;
    let descCol = 6;
    let capDateCol = 7;
    let costCol = 8;

    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let foundMarkers = 0;
      row.eachCell((cell, colNumber) => {
        const text = String(cell.value || '').trim().toLowerCase();
        if (text.includes('asset class')) {
          assetClassCol = colNumber;
          foundMarkers++;
        } else if (text === 'category' || text.includes('category')) {
          categoryCol = colNumber;
          foundMarkers++;
        } else if (text.includes('asset no') || text.includes('sap')) {
          sapCodeCol = colNumber;
          foundMarkers++;
        } else if (text.includes('tagging') || text.includes('tag number')) {
          tagCodeCol = colNumber;
          foundMarkers++;
        } else if (text.includes('description') || text.includes('asset desc')) {
          descCol = colNumber;
          foundMarkers++;
        } else if (text.includes('capitalized') || text.includes('purchase date')) {
          capDateCol = colNumber;
          foundMarkers++;
        } else if (text.includes('cost') || text.includes('bdt')) {
          costCol = colNumber;
          foundMarkers++;
        }
      });
      if (foundMarkers >= 3) {
        headerRowIndex = r;
        break;
      }
    }

    // 2. Query existing categories in DB
    const existingDbCategories = await this.prisma.assetCategory.findMany();
    const categoryByCode = new Map<string, string>();
    const categoryByName = new Map<string, string>();
    for (const cat of existingDbCategories) {
      if (cat.code) categoryByCode.set(cat.code.trim().toUpperCase(), cat.id);
      if (cat.name) categoryByName.set(cat.name.trim().toLowerCase(), cat.id);
    }

    // 3. Collect categories in Excel and identify new ones
    const newCategories: string[] = [];
    const seenCatCodes = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;
      const rawClass = row.getCell(assetClassCol).value;
      const rawCatName = row.getCell(categoryCol).value;
      const assetClass = rawClass ? String(rawClass).trim() : '';
      const categoryName = rawCatName
        ? String(rawCatName).trim()
        : assetClass
          ? `Class ${assetClass}`
          : 'General Assets';
      const catCode = assetClass
        ? `CAT-${assetClass}`
        : `CAT-${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

      const codeKey = catCode.toUpperCase();
      const nameKey = categoryName.toLowerCase();

      if (!categoryByCode.has(codeKey) && !categoryByName.has(nameKey)) {
        if (!seenCatCodes.has(codeKey)) {
          seenCatCodes.add(codeKey);
          newCategories.push(`${categoryName} (${catCode})`);
        }
      }
    });

    // 4. Query existing assets in DB
    const existingAssets = await this.prisma.asset.findMany({
      select: { assetCode: true, sapAssetCode: true },
    });
    const existingSapCodes = new Set(
      existingAssets
        .map((a) => a.sapAssetCode)
        .filter((c): c is string => Boolean(c))
        .map((c) => c.trim()),
    );
    const existingAssetCodes = new Set(
      existingAssets
        .map((a) => a.assetCode)
        .filter((c): c is string => Boolean(c))
        .map((c) => c.trim()),
    );

    // 5. Compare each row
    const newAssets: Array<{
      rowNumber: number;
      sapAssetCode: string;
      assetCode: string;
      name: string;
      category: string;
      purchaseDate: string | null;
      purchaseCost: number | null;
    }> = [];

    let existingCount = 0;
    let skippedInvalid = 0;
    const seenSapInBatch = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;

      const rawAssetNo = row.getCell(sapCodeCol).value;
      if (!rawAssetNo) {
        skippedInvalid++;
        return;
      }

      const sapAssetCode = String(rawAssetNo).trim();
      if (!sapAssetCode || sapAssetCode.toLowerCase() === 'null') {
        skippedInvalid++;
        return;
      }

      // Check if existing in DB or duplicate in same file
      if (existingSapCodes.has(sapAssetCode) || seenSapInBatch.has(sapAssetCode)) {
        existingCount++;
        return;
      }
      seenSapInBatch.add(sapAssetCode);

      // Asset Code
      const rawTaggingNo = row.getCell(tagCodeCol).value;
      let assetCode = rawTaggingNo ? String(rawTaggingNo).trim() : '';
      if (!assetCode || assetCode.toLowerCase() === 'null' || existingAssetCodes.has(assetCode)) {
        assetCode = `AST-${sapAssetCode}`;
      }

      // Description / Name
      const rawDesc = row.getCell(descCol).value;
      const name = rawDesc ? String(rawDesc).trim() : `Asset ${sapAssetCode}`;

      // Category Name
      const rawCatName = row.getCell(categoryCol).value;
      const rawClass = row.getCell(assetClassCol).value;
      const category = rawCatName ? String(rawCatName).trim() : (rawClass ? `Class ${rawClass}` : 'General Assets');

      // Capitalized / Purchase Date
      const rawDate = row.getCell(capDateCol).value;
      let purchaseDateStr: string | null = null;
      if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        purchaseDateStr = rawDate.toISOString().slice(0, 10);
      } else if (rawDate) {
        const parsed = new Date(String(rawDate));
        if (!isNaN(parsed.getTime())) {
          purchaseDateStr = parsed.toISOString().slice(0, 10);
        }
      }

      // Cost
      const rawCost = row.getCell(costCol).value;
      let purchaseCostNum: number | null = null;
      if (typeof rawCost === 'number' && !isNaN(rawCost)) {
        purchaseCostNum = rawCost;
      } else if (rawCost) {
        const num = parseFloat(String(rawCost).replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) purchaseCostNum = num;
      }

      newAssets.push({
        rowNumber,
        sapAssetCode,
        assetCode,
        name,
        category,
        purchaseDate: purchaseDateStr,
        purchaseCost: purchaseCostNum,
      });
    });

    const totalDataRows = sheet.rowCount - headerRowIndex;

    return {
      totalRows: totalDataRows > 0 ? totalDataRows : 0,
      existingCount,
      newCount: newAssets.length,
      invalidCount: skippedInvalid,
      newCategories,
      newCategoriesCount: newCategories.length,
      newAssets,
    };
  }

  // ── Import from Excel ────────────────────────────────────────────────────────
  async importExcel(fileBuffer: Buffer, userId?: string) {
    const startTime = Date.now();
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (e: any) {
      throw new BadRequestException(`Could not read Excel file: ${e.message}`);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Excel workbook has no worksheets');
    }

    // Pre-flight database check
    let createdById = userId;
    let rootCompany: any;
    try {
      if (!createdById) {
        const admin = await this.prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN' },
        });
        if (admin) {
          createdById = admin.id;
        } else {
          const newAdmin = await this.prisma.user.create({
            data: {
              email: 'system.admin@assets.com',
              name: 'System Admin',
              role: 'SUPER_ADMIN',
              passwordHash: '$2a$12$e8F0sM8y07d6K4rM2/8V6OQ4xP.W4O8j1N2G.7p8M8Q8r8M8j1N2G',
            },
          });
          createdById = newAdmin.id;
        }
      }

      rootCompany = await this.prisma.location.findFirst({
        where: { type: 'COMPANY' },
      });
      if (!rootCompany) {
        rootCompany = await this.prisma.location.create({
          data: {
            name: 'Apex ABL Manufacturing',
            code: 'ABL-CORP',
            type: 'COMPANY',
            qrCode: 'LOC:ABL-CORP',
            description: 'Root enterprise manufacturing location',
          },
        });
      }
    } catch (dbErr: any) {
      throw new BadRequestException(
        `Database connection error: ${dbErr.message}. Ensure Microsoft SQL Server is running on port 1433 and run "npm run db:push" to create the database schema.`,
      );
    }

    // 1. Detect header row & column indices dynamically
    let headerRowIndex = 3;
    let assetClassCol = 2;
    let categoryCol = 3;
    let sapCodeCol = 4;
    let tagCodeCol = 5;
    let descCol = 6;
    let capDateCol = 7;
    let costCol = 8;

    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let foundMarkers = 0;
      row.eachCell((cell, colNumber) => {
        const text = String(cell.value || '').trim().toLowerCase();
        if (text.includes('asset class')) {
          assetClassCol = colNumber;
          foundMarkers++;
        } else if (text === 'category' || text.includes('category')) {
          categoryCol = colNumber;
          foundMarkers++;
        } else if (text.includes('asset no') || text.includes('sap')) {
          sapCodeCol = colNumber;
          foundMarkers++;
        } else if (text.includes('tagging') || text.includes('tag number')) {
          tagCodeCol = colNumber;
          foundMarkers++;
        } else if (text.includes('description') || text.includes('asset desc')) {
          descCol = colNumber;
          foundMarkers++;
        } else if (text.includes('capitalized') || text.includes('purchase date')) {
          capDateCol = colNumber;
          foundMarkers++;
        } else if (text.includes('cost') || text.includes('bdt')) {
          costCol = colNumber;
          foundMarkers++;
        }
      });
      if (foundMarkers >= 3) {
        headerRowIndex = r;
        break;
      }
    }

    // 2. Fetch existing categories from the database
    const existingDbCategories = await this.prisma.assetCategory.findMany();
    const categoryByCode = new Map<string, string>(); // UPPER(code) -> id
    const categoryByName = new Map<string, string>(); // lower(name) -> id

    for (const cat of existingDbCategories) {
      if (cat.code) categoryByCode.set(cat.code.trim().toUpperCase(), cat.id);
      if (cat.name) categoryByName.set(cat.name.trim().toLowerCase(), cat.id);
    }

    // 3. Discover all distinct categories in the Excel sheet
    const excelCategories = new Map<string, { code: string; name: string; description: string }>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;

      const rawClass = row.getCell(assetClassCol).value;
      const rawCatName = row.getCell(categoryCol).value;

      const assetClass = rawClass ? String(rawClass).trim() : '';
      const categoryName = rawCatName
        ? String(rawCatName).trim()
        : assetClass
          ? `Class ${assetClass}`
          : 'General Assets';
      const catCode = assetClass
        ? `CAT-${assetClass}`
        : `CAT-${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

      if (!excelCategories.has(catCode)) {
        excelCategories.set(catCode, {
          code: catCode,
          name: categoryName,
          description: assetClass ? `Asset Class ${assetClass} - ${categoryName}` : categoryName,
        });
      }
    });

    // 4. Check if any category is new -> upload the category first!
    const categoryIdMap = new Map<string, string>(); // catCode -> categoryId
    const newlyCreatedCategories: Array<{ id: string; name: string; code: string }> = [];

    for (const [code, catInfo] of excelCategories.entries()) {
      const codeKey = code.toUpperCase();
      const nameKey = catInfo.name.toLowerCase();

      const existingId = categoryByCode.get(codeKey) || categoryByName.get(nameKey);

      if (existingId) {
        categoryIdMap.set(code, existingId);
      } else {
        // Upload new category first to database
        let uniqueCode = catInfo.code;
        let suffix = 1;
        while (categoryByCode.has(uniqueCode.toUpperCase())) {
          uniqueCode = `${catInfo.code}_${suffix++}`;
        }

        const newDbCat = await this.prisma.assetCategory.create({
          data: {
            name: catInfo.name,
            code: uniqueCode,
            description: catInfo.description,
            isActive: true,
          },
        });

        categoryByCode.set(newDbCat.code.toUpperCase(), newDbCat.id);
        categoryByName.set(newDbCat.name.toLowerCase(), newDbCat.id);
        categoryIdMap.set(code, newDbCat.id);
        newlyCreatedCategories.push({
          id: newDbCat.id,
          name: newDbCat.name,
          code: newDbCat.code,
        });
      }
    }

    // 5. Query existing assets in database to enforce "New SAP Code Only" rule
    const existingAssets = await this.prisma.asset.findMany({
      select: { assetCode: true, sapAssetCode: true },
    });
    const existingSapCodes = new Set(
      existingAssets
        .map((a) => a.sapAssetCode)
        .filter((c): c is string => Boolean(c))
        .map((c) => c.trim()),
    );
    const existingAssetCodes = new Set(
      existingAssets
        .map((a) => a.assetCode)
        .filter((c): c is string => Boolean(c))
        .map((c) => c.trim()),
    );

    // 6. Parse rows: ONLY upload records with NEW SAP codes
    const assetsToInsert: any[] = [];
    let skippedExistingSap = 0;
    let skippedInvalid = 0;
    const seenSapInBatch = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return;

      const rawAssetNo = row.getCell(sapCodeCol).value;
      if (!rawAssetNo) {
        skippedInvalid++;
        return;
      }

      const sapAssetCode = String(rawAssetNo).trim();
      if (!sapAssetCode) {
        skippedInvalid++;
        return;
      }

      // Check if SAP code already exists in DB or was already seen in this file
      if (existingSapCodes.has(sapAssetCode) || seenSapInBatch.has(sapAssetCode)) {
        skippedExistingSap++;
        return; // SKIP: System uploads new SAP code only
      }

      seenSapInBatch.add(sapAssetCode);

      // Resolve physical tag / assetCode
      const rawTaggingNumber = row.getCell(tagCodeCol).value;
      let assetCode: string;
      if (typeof rawTaggingNumber === 'object' && rawTaggingNumber !== null) {
        assetCode = String((rawTaggingNumber as any).result || `ABL-${sapAssetCode}`).trim();
      } else {
        assetCode = rawTaggingNumber ? String(rawTaggingNumber).trim() : `ABL-${sapAssetCode}`;
      }

      // Ensure assetCode uniqueness in database
      if (existingAssetCodes.has(assetCode)) {
        assetCode = `${assetCode}-${sapAssetCode}`;
      }
      existingAssetCodes.add(assetCode);

      // Resolve category ID
      const rawClass = row.getCell(assetClassCol).value;
      const rawCatName = row.getCell(categoryCol).value;
      const assetClass = rawClass ? String(rawClass).trim() : '';
      const categoryName = rawCatName
        ? String(rawCatName).trim()
        : assetClass
          ? `Class ${assetClass}`
          : 'General Assets';
      const catCode = assetClass
        ? `CAT-${assetClass}`
        : `CAT-${categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      const categoryId = categoryIdMap.get(catCode) || null;

      // Resolve description / name
      const rawDescription = row.getCell(descCol).value;
      const name = rawDescription ? String(rawDescription).trim() : `Asset ${sapAssetCode}`;
      const description = name;

      // Resolve Capitalized Date
      const rawCapitalizedDate = row.getCell(capDateCol).value;
      let purchaseDate: Date | null = null;
      if (rawCapitalizedDate) {
        const d = new Date(String(rawCapitalizedDate));
        if (!isNaN(d.getTime())) {
          purchaseDate = d;
        }
      }

      // Resolve Asset Cost BDT'K
      const rawCost = row.getCell(costCol).value;
      let costValue: Prisma.Decimal | null = null;
      if (rawCost !== undefined && rawCost !== null) {
        const num = typeof rawCost === 'object' ? Number((rawCost as any).result) : Number(rawCost);
        if (!isNaN(num)) {
          costValue = new Prisma.Decimal(num);
        }
      }

      assetsToInsert.push({
        assetCode,
        sapAssetCode,
        name,
        description,
        status: 'ACTIVE',
        categoryId,
        locationId: rootCompany.id,
        purchaseDate,
        purchaseCost: costValue,
        currentValue: costValue,
        qrCode: sapAssetCode, // QR code scan data is SAP Code
        createdById,
        isActive: true,
      });
    });

    // 7. Batch insert new assets in chunks of 1000
    const BATCH_SIZE = 1000;
    let insertedTotal = 0;

    for (let i = 0; i < assetsToInsert.length; i += BATCH_SIZE) {
      const batch = assetsToInsert.slice(i, i + BATCH_SIZE);
      await this.prisma.asset.createMany({ data: batch });
      insertedTotal += batch.length;
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalDataRows = sheet.rowCount - headerRowIndex;

    const message =
      insertedTotal > 0
        ? `Successfully imported ${insertedTotal} new assets (${skippedExistingSap} existing SAP codes skipped, ${newlyCreatedCategories.length} new categories uploaded first) in ${elapsedSeconds}s`
        : `No new SAP codes to import (${skippedExistingSap} existing SAP codes skipped, ${newlyCreatedCategories.length} new categories synced) in ${elapsedSeconds}s`;

    return {
      success: true,
      totalRows: totalDataRows > 0 ? totalDataRows : 0,
      imported: insertedTotal,
      skipped: skippedExistingSap + skippedInvalid,
      skippedExistingSap,
      skippedInvalid,
      categoriesCount: categoryIdMap.size,
      newCategoriesCount: newlyCreatedCategories.length,
      newCategories: newlyCreatedCategories.map((c) => `${c.name} (${c.code})`),
      elapsedSeconds,
      message,
    };
  }
}
