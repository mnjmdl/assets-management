import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Zod Validators — @repo/validators
// Used by both NestJS API (via class-validator wrapper) and Next.js (forms)
// ─────────────────────────────────────────────────────────────────────────────

// ── Common ───────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const IdParamSchema = z.object({
  id: z.string().cuid(),
});

// ── Auth ─────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterSchema = z.object({
  employeeId: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum([
    'SUPER_ADMIN', 'ASSET_MANAGER', 'AUDITOR',
    'DEPARTMENT_HEAD', 'EMPLOYEE', 'VIEWER',
  ]).default('EMPLOYEE'),
  phone: z.string().optional(),
  departmentId: z.string().cuid().optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Departments ───────────────────────────────────────────────────────────────

export const CreateDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  description: z.string().optional(),
  parentId: z.string().cuid().optional(),
  managerId: z.string().cuid().optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

// ── Locations ─────────────────────────────────────────────────────────────────

export const LocationTypeSchema = z.enum(['COMPANY', 'UNIT', 'BLOCK', 'LINE']);

export const CreateLocationSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  type: LocationTypeSchema,
  building: z.string().optional(),
  floor: z.string().optional(),
  room: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().cuid().optional(),
});

export const UpdateLocationSchema = CreateLocationSchema.partial();

// ── Asset Categories ──────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  description: z.string().optional(),
  parentId: z.string().cuid().optional(),
  customFieldSchema: z.string().optional(), // JSON string
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

// ── Assets ────────────────────────────────────────────────────────────────────

export const CreateAssetSchema = z.object({
  name: z.string().min(2, 'Asset name is required').max(200),
  sapAssetCode: z.string().min(1, 'SAP asset code is required'),
  description: z.string().optional(),
  categoryId: z.string().cuid('Invalid category'),
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  color: z.string().optional(),
  condition: z.enum(['GOOD', 'FAIR', 'POOR']).optional(),
  purchaseDate: z.coerce.date().optional(),
  purchaseCost: z.coerce.number().positive().optional(),
  depreciationMethod: z
    .enum(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE'])
    .default('STRAIGHT_LINE'),
  depreciationRate: z.coerce.number().min(0).max(100).optional(),
  usefulLifeYears: z.coerce.number().int().positive().optional(),
  vendorId: z.string().cuid().optional(),
  invoiceNumber: z.string().optional(),
  warrantyExpiry: z.coerce.date().optional(),
  warrantyDetails: z.string().optional(),
  locationId: z.string().cuid().optional(),
  departmentId: z.string().cuid().optional(),
  customFields: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export const UpdateAssetSchema = CreateAssetSchema.partial();

export const UpdateAssetStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'ASSIGNED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED', 'LOST']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const AssetFilterSchema = PaginationSchema.extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'ASSIGNED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED', 'LOST']).optional(),
  categoryId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  departmentId: z.string().cuid().optional(),
  vendorId: z.string().cuid().optional(),
  warrantyExpiryBefore: z.coerce.date().optional(),
  purchaseDateFrom: z.coerce.date().optional(),
  purchaseDateTo: z.coerce.date().optional(),
  sapAssetCode: z.string().optional(),
});

// ── Assignments ───────────────────────────────────────────────────────────────

export const CreateAssignmentSchema = z
  .object({
    assetId: z.string().cuid('Invalid asset'),
    assignedToUserId: z.string().cuid().optional(),
    assignedToDeptId: z.string().cuid().optional(),
    locationId: z.string().cuid().optional(),
    expectedReturnAt: z.coerce.date().optional(),
    conditionOut: z.enum(['GOOD', 'FAIR', 'POOR']).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (d) => d.assignedToUserId || d.assignedToDeptId,
    { message: 'Must assign to either a user or a department' },
  );

export const ReturnAssetSchema = z.object({
  conditionIn: z.enum(['GOOD', 'FAIR', 'POOR']).optional(),
  notes: z.string().optional(),
});

// ── Transfers ─────────────────────────────────────────────────────────────────

export const CreateTransferSchema = z.object({
  assetId: z.string().cuid('Invalid asset'),
  toDeptId: z.string().cuid('Invalid target department'),
  reason: z.string().min(5, 'Please provide a reason').max(500),
  notes: z.string().optional(),
});

export const ApproveTransferSchema = z.object({
  notes: z.string().optional(),
});

export const RejectTransferSchema = z.object({
  reason: z.string().min(5, 'Please provide a rejection reason'),
});

// ── Vendors ───────────────────────────────────────────────────────────────────

export const CreateVendorSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(2).max(20).toUpperCase(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  website: z.string().url().optional(),
  serviceTypes: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

// ── Maintenance ───────────────────────────────────────────────────────────────

export const CreateMaintenanceScheduleSchema = z.object({
  assetId: z.string().cuid('Invalid asset'),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'INSPECTION']),
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  frequencyDays: z.coerce.number().int().positive().optional(),
  nextDueDate: z.coerce.date().optional(),
  vendorId: z.string().cuid().optional(),
  estimatedCost: z.coerce.number().positive().optional(),
});

export const CreateMaintenanceRecordSchema = z.object({
  assetId: z.string().cuid('Invalid asset'),
  scheduleId: z.string().cuid().optional(),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'INSPECTION']),
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  vendorId: z.string().cuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  cost: z.coerce.number().positive().optional(),
  invoiceRef: z.string().optional(),
  notes: z.string().optional(),
});

export const CompleteMaintenanceSchema = z.object({
  cost: z.coerce.number().positive().optional(),
  invoiceRef: z.string().optional(),
  notes: z.string().optional(),
  completedAt: z.coerce.date().optional(),
});

// ── Audit Plans ───────────────────────────────────────────────────────────────

export const CreateAuditPlanSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  type: z.enum(['SCHEDULED', 'AD_HOC', 'SURPRISE', 'ANNUAL']).default('SCHEDULED'),
  scheduledDate: z.coerce.date().optional(),
  scopeType: z.enum(['ALL', 'DEPARTMENT', 'LOCATION', 'CATEGORY']),
  scopeIds: z.array(z.string()).optional(),
});

export const UpdateAuditPlanSchema = CreateAuditPlanSchema.partial();

export const CreateAuditSessionSchema = z.object({
  planId: z.string().cuid('Invalid audit plan'),
  auditorId: z.string().cuid('Invalid auditor'),
  locationId: z.string().cuid().optional(),
});

export const SubmitAuditItemSchema = z.object({
  assetId: z.string().cuid('Invalid asset'),
  status: z.enum(['FOUND', 'MISSING', 'DAMAGED', 'DISPOSED']),
  foundLocationId: z.string().cuid().optional(),
  condition: z.enum(['GOOD', 'FAIR', 'POOR', 'DAMAGED']).optional(),
  notes: z.string().optional(),
});

export const ResolveDiscrepancySchema = z.object({
  resolutionNotes: z.string().min(5, 'Please provide resolution notes'),
});

// ── Type exports ──────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;
export type AssetFilterInput = z.infer<typeof AssetFilterSchema>;
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
export type CreateAuditPlanInput = z.infer<typeof CreateAuditPlanSchema>;
export type CreateAuditSessionInput = z.infer<typeof CreateAuditSessionSchema>;
export type SubmitAuditItemInput = z.infer<typeof SubmitAuditItemSchema>;
export type CreateMaintenanceScheduleInput = z.infer<typeof CreateMaintenanceScheduleSchema>;
export type CreateMaintenanceRecordInput = z.infer<typeof CreateMaintenanceRecordSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
