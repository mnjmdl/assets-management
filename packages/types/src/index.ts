// ─────────────────────────────────────────────────────────────────────────────
// Shared Types — @repo/types
// Used by both NestJS API and Next.js Web
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums (mirror Prisma enums for frontend use) ─────────────────────────────

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ASSET_MANAGER = 'ASSET_MANAGER',
  AUDITOR = 'AUDITOR',
  DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
  EMPLOYEE = 'EMPLOYEE',
  VIEWER = 'VIEWER',
}

export enum AssetStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ASSIGNED = 'ASSIGNED',
  IN_MAINTENANCE = 'IN_MAINTENANCE',
  RETIRED = 'RETIRED',
  DISPOSED = 'DISPOSED',
  LOST = 'LOST',
}

export enum DepreciationMethod {
  STRAIGHT_LINE = 'STRAIGHT_LINE',
  DECLINING_BALANCE = 'DECLINING_BALANCE',
  NONE = 'NONE',
}

export enum AuditType {
  SCHEDULED = 'SCHEDULED',
  AD_HOC = 'AD_HOC',
  SURPRISE = 'SURPRISE',
  ANNUAL = 'ANNUAL',
}

export enum AuditPlanStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum AuditItemStatus {
  PENDING = 'PENDING',
  FOUND = 'FOUND',
  MISSING = 'MISSING',
  DAMAGED = 'DAMAGED',
  DISPOSED = 'DISPOSED',
}

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  INSPECTION = 'INSPECTION',
}

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TransferStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum NotificationType {
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  AUDIT_REMINDER = 'AUDIT_REMINDER',
  ASSET_ASSIGNED = 'ASSET_ASSIGNED',
  TRANSFER_REQUEST = 'TRANSFER_REQUEST',
  TRANSFER_APPROVED = 'TRANSFER_APPROVED',
  TRANSFER_REJECTED = 'TRANSFER_REJECTED',
  WARRANTY_EXPIRY = 'WARRANTY_EXPIRY',
  SYSTEM = 'SYSTEM',
}

// ── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  sub: string;     // userId
  email: string;
  role: Role;
  departmentId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  avatarUrl?: string;
  departmentId?: string;
  departmentName?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

// ── Organization & Locations ──────────────────────────────────────────────────

export enum LocationType {
  COMPANY = 'COMPANY',
  UNIT = 'UNIT',
  BLOCK = 'BLOCK',
  LINE = 'LINE',
}

export interface LocationItem {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  qrCode?: string;
  building?: string;
  floor?: string;
  room?: string;
  description?: string;
  parentId?: string;
  parentName?: string;
  parentType?: LocationType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  assetCount?: number;
}

export interface LocationTreeNode extends LocationItem {
  children?: LocationTreeNode[];
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  parentName?: string;
  managerId?: string;
  managerName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  assetCount?: number;
}

// ── Assets ───────────────────────────────────────────────────────────────────

export interface AssetListItem {
  id: string;
  assetCode: string;
  sapAssetCode: string;
  name: string;
  status: AssetStatus;
  categoryId: string;
  categoryName: string;
  locationId?: string;
  locationName?: string;
  departmentId?: string;
  departmentName?: string;
  purchaseCost?: number;
  currentValue?: number;
  warrantyExpiry?: Date;
  createdAt: Date;
  primaryPhoto?: string;
}

export interface AssetDetail extends AssetListItem {
  description?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  color?: string;
  condition?: string;
  purchaseDate?: Date;
  depreciationMethod: DepreciationMethod;
  depreciationRate?: number;
  usefulLifeYears?: number;
  vendorId?: string;
  vendorName?: string;
  invoiceNumber?: string;
  warrantyDetails?: string;
  qrCode?: string;
  barcode?: string;
  customFields?: Record<string, unknown>;
  notes?: string;
  photos: AssetPhotoItem[];
  documents: AssetDocumentItem[];
  currentAssignment?: AssignmentItem;
  updatedAt: Date;
}

export interface AssetPhotoItem {
  id: string;
  filePath: string;
  fileName: string;
  isPrimary: boolean;
}

export interface AssetDocumentItem {
  id: string;
  docType: string;
  fileName: string;
  filePath: string;
}

// ── Assignments ───────────────────────────────────────────────────────────────

export interface AssignmentItem {
  id: string;
  assetId: string;
  assetCode: string;
  sapAssetCode?: string;
  assetName: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedToDeptId?: string;
  assignedToDeptName?: string;
  locationId?: string;
  locationName?: string;
  assignedById: string;
  assignedByName: string;
  assignedAt: Date;
  expectedReturnAt?: Date;
  returnedAt?: Date;
  conditionOut?: string;
  conditionIn?: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  isActive: boolean;
}

// ── Audits ───────────────────────────────────────────────────────────────────

export interface AuditSummary {
  id: string;
  name: string;
  type: AuditType;
  status: AuditPlanStatus;
  scheduledDate?: Date;
  totalSessions: number;
  completedSessions: number;
  totalItems: number;
  foundItems: number;
  missingItems: number;
  damagedItems: number;
  createdAt: Date;
}

export interface AuditItemScanResult {
  assetId: string;
  assetCode: string;
  sapAssetCode?: string;
  assetName: string;
  expectedLocation?: string;
  status: AuditItemStatus;
  condition?: string;
  notes?: string;
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  totalAssets: number;
  activeAssets: number;
  assetsInMaintenance: number;
  totalAssetValue: number;
  maintenanceDueSoon: number;    // due in next 7 days
  warrantyExpiringSoon: number;  // expiring in next 30 days
  pendingTransfers: number;
  openAudits: number;
  assetsByStatus: { status: AssetStatus; count: number }[];
  assetsByCategory: { categoryName: string; count: number; value: number }[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  action: string;
  module: string;
  description: string;
  timestamp: Date;
  userId: string;
  userName: string;
}

// ── API Response ──────────────────────────────────────────────────────────────

export interface ApiResponse<T = void> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}
