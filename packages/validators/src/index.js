"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveDiscrepancySchema = exports.SubmitAuditItemSchema = exports.CreateAuditSessionSchema = exports.UpdateAuditPlanSchema = exports.CreateAuditPlanSchema = exports.CompleteMaintenanceSchema = exports.CreateMaintenanceRecordSchema = exports.CreateMaintenanceScheduleSchema = exports.UpdateVendorSchema = exports.CreateVendorSchema = exports.RejectTransferSchema = exports.ApproveTransferSchema = exports.CreateTransferSchema = exports.ReturnAssetSchema = exports.CreateAssignmentSchema = exports.AssetFilterSchema = exports.UpdateAssetStatusSchema = exports.UpdateAssetSchema = exports.CreateAssetSchema = exports.UpdateCategorySchema = exports.CreateCategorySchema = exports.UpdateLocationSchema = exports.CreateLocationSchema = exports.LocationTypeSchema = exports.UpdateDepartmentSchema = exports.CreateDepartmentSchema = exports.RefreshTokenSchema = exports.ChangePasswordSchema = exports.RegisterSchema = exports.LoginSchema = exports.IdParamSchema = exports.PaginationSchema = void 0;
const zod_1 = require("zod");
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().optional(),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
exports.IdParamSchema = zod_1.z.object({
    id: zod_1.z.string().cuid(),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.RegisterSchema = zod_1.z.object({
    employeeId: zod_1.z.string().optional(),
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    role: zod_1.z.enum([
        'SUPER_ADMIN', 'ASSET_MANAGER', 'AUDITOR',
        'DEPARTMENT_HEAD', 'EMPLOYEE', 'VIEWER',
    ]).default('EMPLOYEE'),
    phone: zod_1.z.string().optional(),
    departmentId: zod_1.z.string().cuid().optional(),
});
exports.ChangePasswordSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: zod_1.z.string(),
})
    .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
exports.RefreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1),
});
exports.CreateDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    code: zod_1.z.string().min(2).max(20).toUpperCase(),
    description: zod_1.z.string().optional(),
    parentId: zod_1.z.string().cuid().optional(),
    managerId: zod_1.z.string().cuid().optional(),
});
exports.UpdateDepartmentSchema = exports.CreateDepartmentSchema.partial();
exports.LocationTypeSchema = zod_1.z.enum(['COMPANY', 'UNIT', 'BLOCK', 'LINE']);
exports.CreateLocationSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    code: zod_1.z.string().min(2).max(20).toUpperCase(),
    type: exports.LocationTypeSchema,
    building: zod_1.z.string().optional(),
    floor: zod_1.z.string().optional(),
    room: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    parentId: zod_1.z.string().cuid().optional(),
});
exports.UpdateLocationSchema = exports.CreateLocationSchema.partial();
exports.CreateCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    code: zod_1.z.string().min(2).max(20).toUpperCase(),
    description: zod_1.z.string().optional(),
    parentId: zod_1.z.string().cuid().optional(),
    customFieldSchema: zod_1.z.string().optional(),
});
exports.UpdateCategorySchema = exports.CreateCategorySchema.partial();
exports.CreateAssetSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Asset name is required').max(200),
    sapAssetCode: zod_1.z.string().min(1, 'SAP asset code is required'),
    description: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().cuid('Invalid category'),
    serialNumber: zod_1.z.string().optional(),
    model: zod_1.z.string().optional(),
    manufacturer: zod_1.z.string().optional(),
    color: zod_1.z.string().optional(),
    condition: zod_1.z.enum(['GOOD', 'FAIR', 'POOR']).optional(),
    purchaseDate: zod_1.z.coerce.date().optional(),
    purchaseCost: zod_1.z.coerce.number().positive().optional(),
    depreciationMethod: zod_1.z
        .enum(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE'])
        .default('STRAIGHT_LINE'),
    depreciationRate: zod_1.z.coerce.number().min(0).max(100).optional(),
    usefulLifeYears: zod_1.z.coerce.number().int().positive().optional(),
    vendorId: zod_1.z.string().cuid().optional(),
    invoiceNumber: zod_1.z.string().optional(),
    warrantyExpiry: zod_1.z.coerce.date().optional(),
    warrantyDetails: zod_1.z.string().optional(),
    locationId: zod_1.z.string().cuid().optional(),
    departmentId: zod_1.z.string().cuid().optional(),
    customFields: zod_1.z.record(zod_1.z.unknown()).optional(),
    notes: zod_1.z.string().optional(),
});
exports.UpdateAssetSchema = exports.CreateAssetSchema.partial();
exports.UpdateAssetStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['DRAFT', 'ACTIVE', 'ASSIGNED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED', 'LOST']),
    reason: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.AssetFilterSchema = exports.PaginationSchema.extend({
    status: zod_1.z.enum(['DRAFT', 'ACTIVE', 'ASSIGNED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED', 'LOST']).optional(),
    categoryId: zod_1.z.string().cuid().optional(),
    locationId: zod_1.z.string().cuid().optional(),
    departmentId: zod_1.z.string().cuid().optional(),
    vendorId: zod_1.z.string().cuid().optional(),
    warrantyExpiryBefore: zod_1.z.coerce.date().optional(),
    purchaseDateFrom: zod_1.z.coerce.date().optional(),
    purchaseDateTo: zod_1.z.coerce.date().optional(),
    sapAssetCode: zod_1.z.string().optional(),
});
exports.CreateAssignmentSchema = zod_1.z
    .object({
    assetId: zod_1.z.string().cuid('Invalid asset'),
    assignedToUserId: zod_1.z.string().cuid().optional(),
    assignedToDeptId: zod_1.z.string().cuid().optional(),
    locationId: zod_1.z.string().cuid().optional(),
    expectedReturnAt: zod_1.z.coerce.date().optional(),
    conditionOut: zod_1.z.enum(['GOOD', 'FAIR', 'POOR']).optional(),
    notes: zod_1.z.string().optional(),
})
    .refine((d) => d.assignedToUserId || d.assignedToDeptId, { message: 'Must assign to either a user or a department' });
exports.ReturnAssetSchema = zod_1.z.object({
    conditionIn: zod_1.z.enum(['GOOD', 'FAIR', 'POOR']).optional(),
    notes: zod_1.z.string().optional(),
});
exports.CreateTransferSchema = zod_1.z.object({
    assetId: zod_1.z.string().cuid('Invalid asset'),
    toDeptId: zod_1.z.string().cuid('Invalid target department'),
    reason: zod_1.z.string().min(5, 'Please provide a reason').max(500),
    notes: zod_1.z.string().optional(),
});
exports.ApproveTransferSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
});
exports.RejectTransferSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5, 'Please provide a rejection reason'),
});
exports.CreateVendorSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(200),
    code: zod_1.z.string().min(2).max(20).toUpperCase(),
    contactPerson: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
    website: zod_1.z.string().url().optional(),
    serviceTypes: zod_1.z.string().optional(),
});
exports.UpdateVendorSchema = exports.CreateVendorSchema.partial();
exports.CreateMaintenanceScheduleSchema = zod_1.z.object({
    assetId: zod_1.z.string().cuid('Invalid asset'),
    type: zod_1.z.enum(['PREVENTIVE', 'CORRECTIVE', 'INSPECTION']),
    title: zod_1.z.string().min(3).max(200),
    description: zod_1.z.string().optional(),
    frequencyDays: zod_1.z.coerce.number().int().positive().optional(),
    nextDueDate: zod_1.z.coerce.date().optional(),
    vendorId: zod_1.z.string().cuid().optional(),
    estimatedCost: zod_1.z.coerce.number().positive().optional(),
});
exports.CreateMaintenanceRecordSchema = zod_1.z.object({
    assetId: zod_1.z.string().cuid('Invalid asset'),
    scheduleId: zod_1.z.string().cuid().optional(),
    type: zod_1.z.enum(['PREVENTIVE', 'CORRECTIVE', 'INSPECTION']),
    title: zod_1.z.string().min(3).max(200),
    description: zod_1.z.string().optional(),
    vendorId: zod_1.z.string().cuid().optional(),
    scheduledAt: zod_1.z.coerce.date().optional(),
    cost: zod_1.z.coerce.number().positive().optional(),
    invoiceRef: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.CompleteMaintenanceSchema = zod_1.z.object({
    cost: zod_1.z.coerce.number().positive().optional(),
    invoiceRef: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    completedAt: zod_1.z.coerce.date().optional(),
});
exports.CreateAuditPlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(200),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['SCHEDULED', 'AD_HOC', 'SURPRISE']).default('SCHEDULED'),
    scheduledDate: zod_1.z.coerce.date().optional(),
    scopeType: zod_1.z.enum(['ALL', 'DEPARTMENT', 'LOCATION', 'CATEGORY']),
    scopeIds: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.UpdateAuditPlanSchema = exports.CreateAuditPlanSchema.partial();
exports.CreateAuditSessionSchema = zod_1.z.object({
    planId: zod_1.z.string().cuid('Invalid audit plan'),
    auditorId: zod_1.z.string().cuid('Invalid auditor'),
    locationId: zod_1.z.string().cuid().optional(),
});
exports.SubmitAuditItemSchema = zod_1.z.object({
    assetId: zod_1.z.string().cuid('Invalid asset'),
    status: zod_1.z.enum(['FOUND', 'MISSING', 'DAMAGED', 'DISPOSED']),
    foundLocationId: zod_1.z.string().cuid().optional(),
    condition: zod_1.z.enum(['GOOD', 'FAIR', 'POOR', 'DAMAGED']).optional(),
    notes: zod_1.z.string().optional(),
});
exports.ResolveDiscrepancySchema = zod_1.z.object({
    resolutionNotes: zod_1.z.string().min(5, 'Please provide resolution notes'),
});
//# sourceMappingURL=index.js.map