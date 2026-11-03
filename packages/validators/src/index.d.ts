import { z } from 'zod';
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare const IdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RegisterSchema: z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["SUPER_ADMIN", "ASSET_MANAGER", "AUDITOR", "DEPARTMENT_HEAD", "EMPLOYEE", "VIEWER"]>>;
    phone: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    role: "SUPER_ADMIN" | "ASSET_MANAGER" | "AUDITOR" | "DEPARTMENT_HEAD" | "EMPLOYEE" | "VIEWER";
    employeeId?: string | undefined;
    phone?: string | undefined;
    departmentId?: string | undefined;
}, {
    email: string;
    password: string;
    name: string;
    employeeId?: string | undefined;
    role?: "SUPER_ADMIN" | "ASSET_MANAGER" | "AUDITOR" | "DEPARTMENT_HEAD" | "EMPLOYEE" | "VIEWER" | undefined;
    phone?: string | undefined;
    departmentId?: string | undefined;
}>;
export declare const ChangePasswordSchema: z.ZodEffects<z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}>, {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}>;
export declare const RefreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const CreateDepartmentSchema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    parentId: z.ZodOptional<z.ZodString>;
    managerId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    description?: string | undefined;
    parentId?: string | undefined;
    managerId?: string | undefined;
}, {
    code: string;
    name: string;
    description?: string | undefined;
    parentId?: string | undefined;
    managerId?: string | undefined;
}>;
export declare const UpdateDepartmentSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    parentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    managerId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    parentId?: string | undefined;
    managerId?: string | undefined;
}, {
    code?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    parentId?: string | undefined;
    managerId?: string | undefined;
}>;
export declare const LocationTypeSchema: z.ZodEnum<["COMPANY", "UNIT", "BLOCK", "LINE"]>;
export declare const CreateLocationSchema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    type: z.ZodEnum<["COMPANY", "UNIT", "BLOCK", "LINE"]>;
    building: z.ZodOptional<z.ZodString>;
    floor: z.ZodOptional<z.ZodString>;
    room: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    parentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    type: "COMPANY" | "UNIT" | "BLOCK" | "LINE";
    name: string;
    description?: string | undefined;
    parentId?: string | undefined;
    building?: string | undefined;
    floor?: string | undefined;
    room?: string | undefined;
}, {
    code: string;
    type: "COMPANY" | "UNIT" | "BLOCK" | "LINE";
    name: string;
    description?: string | undefined;
    parentId?: string | undefined;
    building?: string | undefined;
    floor?: string | undefined;
    room?: string | undefined;
}>;
export declare const UpdateLocationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["COMPANY", "UNIT", "BLOCK", "LINE"]>>;
    building: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    floor: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    room: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    parentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    type?: "COMPANY" | "UNIT" | "BLOCK" | "LINE" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    parentId?: string | undefined;
    building?: string | undefined;
    floor?: string | undefined;
    room?: string | undefined;
}, {
    code?: string | undefined;
    type?: "COMPANY" | "UNIT" | "BLOCK" | "LINE" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    parentId?: string | undefined;
    building?: string | undefined;
    floor?: string | undefined;
    room?: string | undefined;
}>;
export declare const CreateCategorySchema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    parentId: z.ZodOptional<z.ZodString>;
    customFieldSchema: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    description?: string | undefined;
    parentId?: string | undefined;
    customFieldSchema?: string | undefined;
}, {
    code: string;
    name: string;
    description?: string | undefined;
    parentId?: string | undefined;
    customFieldSchema?: string | undefined;
}>;
export declare const UpdateCategorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    parentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customFieldSchema: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    parentId?: string | undefined;
    customFieldSchema?: string | undefined;
}, {
    code?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    parentId?: string | undefined;
    customFieldSchema?: string | undefined;
}>;
export declare const CreateAssetSchema: z.ZodObject<{
    name: z.ZodString;
    sapAssetCode: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodString;
    serialNumber: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    manufacturer: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    condition: z.ZodOptional<z.ZodEnum<["GOOD", "FAIR", "POOR"]>>;
    purchaseDate: z.ZodOptional<z.ZodDate>;
    purchaseCost: z.ZodOptional<z.ZodNumber>;
    depreciationMethod: z.ZodDefault<z.ZodEnum<["STRAIGHT_LINE", "DECLINING_BALANCE", "NONE"]>>;
    depreciationRate: z.ZodOptional<z.ZodNumber>;
    usefulLifeYears: z.ZodOptional<z.ZodNumber>;
    vendorId: z.ZodOptional<z.ZodString>;
    invoiceNumber: z.ZodOptional<z.ZodString>;
    warrantyExpiry: z.ZodOptional<z.ZodDate>;
    warrantyDetails: z.ZodOptional<z.ZodString>;
    locationId: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodString>;
    customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sapAssetCode: string;
    categoryId: string;
    depreciationMethod: "STRAIGHT_LINE" | "DECLINING_BALANCE" | "NONE";
    departmentId?: string | undefined;
    description?: string | undefined;
    serialNumber?: string | undefined;
    model?: string | undefined;
    manufacturer?: string | undefined;
    color?: string | undefined;
    condition?: "GOOD" | "FAIR" | "POOR" | undefined;
    purchaseDate?: Date | undefined;
    purchaseCost?: number | undefined;
    depreciationRate?: number | undefined;
    usefulLifeYears?: number | undefined;
    vendorId?: string | undefined;
    invoiceNumber?: string | undefined;
    warrantyExpiry?: Date | undefined;
    warrantyDetails?: string | undefined;
    locationId?: string | undefined;
    customFields?: Record<string, unknown> | undefined;
    notes?: string | undefined;
}, {
    name: string;
    sapAssetCode: string;
    categoryId: string;
    departmentId?: string | undefined;
    description?: string | undefined;
    serialNumber?: string | undefined;
    model?: string | undefined;
    manufacturer?: string | undefined;
    color?: string | undefined;
    condition?: "GOOD" | "FAIR" | "POOR" | undefined;
    purchaseDate?: Date | undefined;
    purchaseCost?: number | undefined;
    depreciationMethod?: "STRAIGHT_LINE" | "DECLINING_BALANCE" | "NONE" | undefined;
    depreciationRate?: number | undefined;
    usefulLifeYears?: number | undefined;
    vendorId?: string | undefined;
    invoiceNumber?: string | undefined;
    warrantyExpiry?: Date | undefined;
    warrantyDetails?: string | undefined;
    locationId?: string | undefined;
    customFields?: Record<string, unknown> | undefined;
    notes?: string | undefined;
}>;
export declare const UpdateAssetSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    sapAssetCode: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    categoryId: z.ZodOptional<z.ZodString>;
    serialNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    model: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    manufacturer: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    condition: z.ZodOptional<z.ZodOptional<z.ZodEnum<["GOOD", "FAIR", "POOR"]>>>;
    purchaseDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    purchaseCost: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    depreciationMethod: z.ZodOptional<z.ZodDefault<z.ZodEnum<["STRAIGHT_LINE", "DECLINING_BALANCE", "NONE"]>>>;
    depreciationRate: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    usefulLifeYears: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    vendorId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    invoiceNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    warrantyExpiry: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    warrantyDetails: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    locationId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    departmentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    customFields: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    departmentId?: string | undefined;
    description?: string | undefined;
    sapAssetCode?: string | undefined;
    categoryId?: string | undefined;
    serialNumber?: string | undefined;
    model?: string | undefined;
    manufacturer?: string | undefined;
    color?: string | undefined;
    condition?: "GOOD" | "FAIR" | "POOR" | undefined;
    purchaseDate?: Date | undefined;
    purchaseCost?: number | undefined;
    depreciationMethod?: "STRAIGHT_LINE" | "DECLINING_BALANCE" | "NONE" | undefined;
    depreciationRate?: number | undefined;
    usefulLifeYears?: number | undefined;
    vendorId?: string | undefined;
    invoiceNumber?: string | undefined;
    warrantyExpiry?: Date | undefined;
    warrantyDetails?: string | undefined;
    locationId?: string | undefined;
    customFields?: Record<string, unknown> | undefined;
    notes?: string | undefined;
}, {
    name?: string | undefined;
    departmentId?: string | undefined;
    description?: string | undefined;
    sapAssetCode?: string | undefined;
    categoryId?: string | undefined;
    serialNumber?: string | undefined;
    model?: string | undefined;
    manufacturer?: string | undefined;
    color?: string | undefined;
    condition?: "GOOD" | "FAIR" | "POOR" | undefined;
    purchaseDate?: Date | undefined;
    purchaseCost?: number | undefined;
    depreciationMethod?: "STRAIGHT_LINE" | "DECLINING_BALANCE" | "NONE" | undefined;
    depreciationRate?: number | undefined;
    usefulLifeYears?: number | undefined;
    vendorId?: string | undefined;
    invoiceNumber?: string | undefined;
    warrantyExpiry?: Date | undefined;
    warrantyDetails?: string | undefined;
    locationId?: string | undefined;
    customFields?: Record<string, unknown> | undefined;
    notes?: string | undefined;
}>;
export declare const UpdateAssetStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["DRAFT", "ACTIVE", "ASSIGNED", "IN_MAINTENANCE", "RETIRED", "DISPOSED", "LOST"]>;
    reason: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "DRAFT" | "ACTIVE" | "ASSIGNED" | "IN_MAINTENANCE" | "RETIRED" | "DISPOSED" | "LOST";
    notes?: string | undefined;
    reason?: string | undefined;
}, {
    status: "DRAFT" | "ACTIVE" | "ASSIGNED" | "IN_MAINTENANCE" | "RETIRED" | "DISPOSED" | "LOST";
    notes?: string | undefined;
    reason?: string | undefined;
}>;
export declare const AssetFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "ACTIVE", "ASSIGNED", "IN_MAINTENANCE", "RETIRED", "DISPOSED", "LOST"]>>;
    categoryId: z.ZodOptional<z.ZodString>;
    locationId: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodString>;
    vendorId: z.ZodOptional<z.ZodString>;
    warrantyExpiryBefore: z.ZodOptional<z.ZodDate>;
    purchaseDateFrom: z.ZodOptional<z.ZodDate>;
    purchaseDateTo: z.ZodOptional<z.ZodDate>;
    sapAssetCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    sortBy?: string | undefined;
    status?: "DRAFT" | "ACTIVE" | "ASSIGNED" | "IN_MAINTENANCE" | "RETIRED" | "DISPOSED" | "LOST" | undefined;
    departmentId?: string | undefined;
    sapAssetCode?: string | undefined;
    categoryId?: string | undefined;
    vendorId?: string | undefined;
    locationId?: string | undefined;
    warrantyExpiryBefore?: Date | undefined;
    purchaseDateFrom?: Date | undefined;
    purchaseDateTo?: Date | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    status?: "DRAFT" | "ACTIVE" | "ASSIGNED" | "IN_MAINTENANCE" | "RETIRED" | "DISPOSED" | "LOST" | undefined;
    departmentId?: string | undefined;
    sapAssetCode?: string | undefined;
    categoryId?: string | undefined;
    vendorId?: string | undefined;
    locationId?: string | undefined;
    warrantyExpiryBefore?: Date | undefined;
    purchaseDateFrom?: Date | undefined;
    purchaseDateTo?: Date | undefined;
}>;
export declare const CreateAssignmentSchema: z.ZodEffects<z.ZodObject<{
    assetId: z.ZodString;
    assignedToUserId: z.ZodOptional<z.ZodString>;
    assignedToDeptId: z.ZodOptional<z.ZodString>;
    locationId: z.ZodOptional<z.ZodString>;
    expectedReturnAt: z.ZodOptional<z.ZodDate>;
    conditionOut: z.ZodOptional<z.ZodEnum<["GOOD", "FAIR", "POOR"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    assetId: string;
    locationId?: string | undefined;
    notes?: string | undefined;
    assignedToUserId?: string | undefined;
    assignedToDeptId?: string | undefined;
    expectedReturnAt?: Date | undefined;
    conditionOut?: "GOOD" | "FAIR" | "POOR" | undefined;
}, {
    assetId: string;
    locationId?: string | undefined;
    notes?: string | undefined;
    assignedToUserId?: string | undefined;
    assignedToDeptId?: string | undefined;
    expectedReturnAt?: Date | undefined;
    conditionOut?: "GOOD" | "FAIR" | "POOR" | undefined;
}>, {
    assetId: string;
    locationId?: string | undefined;
    notes?: string | undefined;
    assignedToUserId?: string | undefined;
    assignedToDeptId?: string | undefined;
    expectedReturnAt?: Date | undefined;
    conditionOut?: "GOOD" | "FAIR" | "POOR" | undefined;
}, {
    assetId: string;
    locationId?: string | undefined;
    notes?: string | undefined;
    assignedToUserId?: string | undefined;
    assignedToDeptId?: string | undefined;
    expectedReturnAt?: Date | undefined;
    conditionOut?: "GOOD" | "FAIR" | "POOR" | undefined;
}>;
export declare const ReturnAssetSchema: z.ZodObject<{
    conditionIn: z.ZodOptional<z.ZodEnum<["GOOD", "FAIR", "POOR"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    conditionIn?: "GOOD" | "FAIR" | "POOR" | undefined;
}, {
    notes?: string | undefined;
    conditionIn?: "GOOD" | "FAIR" | "POOR" | undefined;
}>;
export declare const CreateTransferSchema: z.ZodObject<{
    assetId: z.ZodString;
    toDeptId: z.ZodString;
    reason: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    assetId: string;
    toDeptId: string;
    notes?: string | undefined;
}, {
    reason: string;
    assetId: string;
    toDeptId: string;
    notes?: string | undefined;
}>;
export declare const ApproveTransferSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
}, {
    notes?: string | undefined;
}>;
export declare const RejectTransferSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const CreateVendorSchema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    contactPerson: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    website: z.ZodOptional<z.ZodString>;
    serviceTypes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    contactPerson?: string | undefined;
    address?: string | undefined;
    website?: string | undefined;
    serviceTypes?: string | undefined;
}, {
    code: string;
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    contactPerson?: string | undefined;
    address?: string | undefined;
    website?: string | undefined;
    serviceTypes?: string | undefined;
}>;
export declare const UpdateVendorSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    contactPerson: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    website: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    serviceTypes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    contactPerson?: string | undefined;
    address?: string | undefined;
    website?: string | undefined;
    serviceTypes?: string | undefined;
}, {
    code?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    contactPerson?: string | undefined;
    address?: string | undefined;
    website?: string | undefined;
    serviceTypes?: string | undefined;
}>;
export declare const CreateMaintenanceScheduleSchema: z.ZodObject<{
    assetId: z.ZodString;
    type: z.ZodEnum<["PREVENTIVE", "CORRECTIVE", "INSPECTION"]>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    frequencyDays: z.ZodOptional<z.ZodNumber>;
    nextDueDate: z.ZodOptional<z.ZodDate>;
    vendorId: z.ZodOptional<z.ZodString>;
    estimatedCost: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION";
    assetId: string;
    title: string;
    description?: string | undefined;
    vendorId?: string | undefined;
    frequencyDays?: number | undefined;
    nextDueDate?: Date | undefined;
    estimatedCost?: number | undefined;
}, {
    type: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION";
    assetId: string;
    title: string;
    description?: string | undefined;
    vendorId?: string | undefined;
    frequencyDays?: number | undefined;
    nextDueDate?: Date | undefined;
    estimatedCost?: number | undefined;
}>;
export declare const CreateMaintenanceRecordSchema: z.ZodObject<{
    assetId: z.ZodString;
    scheduleId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["PREVENTIVE", "CORRECTIVE", "INSPECTION"]>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    vendorId: z.ZodOptional<z.ZodString>;
    scheduledAt: z.ZodOptional<z.ZodDate>;
    cost: z.ZodOptional<z.ZodNumber>;
    invoiceRef: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION";
    assetId: string;
    title: string;
    description?: string | undefined;
    vendorId?: string | undefined;
    notes?: string | undefined;
    scheduleId?: string | undefined;
    scheduledAt?: Date | undefined;
    cost?: number | undefined;
    invoiceRef?: string | undefined;
}, {
    type: "PREVENTIVE" | "CORRECTIVE" | "INSPECTION";
    assetId: string;
    title: string;
    description?: string | undefined;
    vendorId?: string | undefined;
    notes?: string | undefined;
    scheduleId?: string | undefined;
    scheduledAt?: Date | undefined;
    cost?: number | undefined;
    invoiceRef?: string | undefined;
}>;
export declare const CompleteMaintenanceSchema: z.ZodObject<{
    cost: z.ZodOptional<z.ZodNumber>;
    invoiceRef: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    cost?: number | undefined;
    invoiceRef?: string | undefined;
    completedAt?: Date | undefined;
}, {
    notes?: string | undefined;
    cost?: number | undefined;
    invoiceRef?: string | undefined;
    completedAt?: Date | undefined;
}>;
export declare const CreateAuditPlanSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodDefault<z.ZodEnum<["SCHEDULED", "AD_HOC", "SURPRISE"]>>;
    scheduledDate: z.ZodOptional<z.ZodDate>;
    scopeType: z.ZodEnum<["ALL", "DEPARTMENT", "LOCATION", "CATEGORY"]>;
    scopeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "SCHEDULED" | "AD_HOC" | "SURPRISE";
    name: string;
    scopeType: "ALL" | "DEPARTMENT" | "LOCATION" | "CATEGORY";
    description?: string | undefined;
    scheduledDate?: Date | undefined;
    scopeIds?: string[] | undefined;
}, {
    name: string;
    scopeType: "ALL" | "DEPARTMENT" | "LOCATION" | "CATEGORY";
    type?: "SCHEDULED" | "AD_HOC" | "SURPRISE" | undefined;
    description?: string | undefined;
    scheduledDate?: Date | undefined;
    scopeIds?: string[] | undefined;
}>;
export declare const UpdateAuditPlanSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    type: z.ZodOptional<z.ZodDefault<z.ZodEnum<["SCHEDULED", "AD_HOC", "SURPRISE"]>>>;
    scheduledDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    scopeType: z.ZodOptional<z.ZodEnum<["ALL", "DEPARTMENT", "LOCATION", "CATEGORY"]>>;
    scopeIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    type?: "SCHEDULED" | "AD_HOC" | "SURPRISE" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    scheduledDate?: Date | undefined;
    scopeType?: "ALL" | "DEPARTMENT" | "LOCATION" | "CATEGORY" | undefined;
    scopeIds?: string[] | undefined;
}, {
    type?: "SCHEDULED" | "AD_HOC" | "SURPRISE" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    scheduledDate?: Date | undefined;
    scopeType?: "ALL" | "DEPARTMENT" | "LOCATION" | "CATEGORY" | undefined;
    scopeIds?: string[] | undefined;
}>;
export declare const CreateAuditSessionSchema: z.ZodObject<{
    planId: z.ZodString;
    auditorId: z.ZodString;
    locationId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    planId: string;
    auditorId: string;
    locationId?: string | undefined;
}, {
    planId: string;
    auditorId: string;
    locationId?: string | undefined;
}>;
export declare const SubmitAuditItemSchema: z.ZodObject<{
    assetId: z.ZodString;
    status: z.ZodEnum<["FOUND", "MISSING", "DAMAGED", "DISPOSED"]>;
    foundLocationId: z.ZodOptional<z.ZodString>;
    condition: z.ZodOptional<z.ZodEnum<["GOOD", "FAIR", "POOR", "DAMAGED"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "DISPOSED" | "FOUND" | "MISSING" | "DAMAGED";
    assetId: string;
    condition?: "DAMAGED" | "GOOD" | "FAIR" | "POOR" | undefined;
    notes?: string | undefined;
    foundLocationId?: string | undefined;
}, {
    status: "DISPOSED" | "FOUND" | "MISSING" | "DAMAGED";
    assetId: string;
    condition?: "DAMAGED" | "GOOD" | "FAIR" | "POOR" | undefined;
    notes?: string | undefined;
    foundLocationId?: string | undefined;
}>;
export declare const ResolveDiscrepancySchema: z.ZodObject<{
    resolutionNotes: z.ZodString;
}, "strip", z.ZodTypeAny, {
    resolutionNotes: string;
}, {
    resolutionNotes: string;
}>;
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
