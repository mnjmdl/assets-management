"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationType = exports.NotificationType = exports.TransferStatus = exports.MaintenanceStatus = exports.MaintenanceType = exports.AuditItemStatus = exports.AuditPlanStatus = exports.AuditType = exports.DepreciationMethod = exports.AssetStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["SUPER_ADMIN"] = "SUPER_ADMIN";
    Role["ASSET_MANAGER"] = "ASSET_MANAGER";
    Role["AUDITOR"] = "AUDITOR";
    Role["DEPARTMENT_HEAD"] = "DEPARTMENT_HEAD";
    Role["EMPLOYEE"] = "EMPLOYEE";
    Role["VIEWER"] = "VIEWER";
})(Role || (exports.Role = Role = {}));
var AssetStatus;
(function (AssetStatus) {
    AssetStatus["DRAFT"] = "DRAFT";
    AssetStatus["ACTIVE"] = "ACTIVE";
    AssetStatus["ASSIGNED"] = "ASSIGNED";
    AssetStatus["IN_MAINTENANCE"] = "IN_MAINTENANCE";
    AssetStatus["RETIRED"] = "RETIRED";
    AssetStatus["DISPOSED"] = "DISPOSED";
    AssetStatus["LOST"] = "LOST";
})(AssetStatus || (exports.AssetStatus = AssetStatus = {}));
var DepreciationMethod;
(function (DepreciationMethod) {
    DepreciationMethod["STRAIGHT_LINE"] = "STRAIGHT_LINE";
    DepreciationMethod["DECLINING_BALANCE"] = "DECLINING_BALANCE";
    DepreciationMethod["NONE"] = "NONE";
})(DepreciationMethod || (exports.DepreciationMethod = DepreciationMethod = {}));
var AuditType;
(function (AuditType) {
    AuditType["SCHEDULED"] = "SCHEDULED";
    AuditType["AD_HOC"] = "AD_HOC";
    AuditType["SURPRISE"] = "SURPRISE";
})(AuditType || (exports.AuditType = AuditType = {}));
var AuditPlanStatus;
(function (AuditPlanStatus) {
    AuditPlanStatus["DRAFT"] = "DRAFT";
    AuditPlanStatus["PUBLISHED"] = "PUBLISHED";
    AuditPlanStatus["IN_PROGRESS"] = "IN_PROGRESS";
    AuditPlanStatus["COMPLETED"] = "COMPLETED";
    AuditPlanStatus["CANCELLED"] = "CANCELLED";
})(AuditPlanStatus || (exports.AuditPlanStatus = AuditPlanStatus = {}));
var AuditItemStatus;
(function (AuditItemStatus) {
    AuditItemStatus["PENDING"] = "PENDING";
    AuditItemStatus["FOUND"] = "FOUND";
    AuditItemStatus["MISSING"] = "MISSING";
    AuditItemStatus["DAMAGED"] = "DAMAGED";
    AuditItemStatus["DISPOSED"] = "DISPOSED";
})(AuditItemStatus || (exports.AuditItemStatus = AuditItemStatus = {}));
var MaintenanceType;
(function (MaintenanceType) {
    MaintenanceType["PREVENTIVE"] = "PREVENTIVE";
    MaintenanceType["CORRECTIVE"] = "CORRECTIVE";
    MaintenanceType["INSPECTION"] = "INSPECTION";
})(MaintenanceType || (exports.MaintenanceType = MaintenanceType = {}));
var MaintenanceStatus;
(function (MaintenanceStatus) {
    MaintenanceStatus["SCHEDULED"] = "SCHEDULED";
    MaintenanceStatus["IN_PROGRESS"] = "IN_PROGRESS";
    MaintenanceStatus["COMPLETED"] = "COMPLETED";
    MaintenanceStatus["CANCELLED"] = "CANCELLED";
})(MaintenanceStatus || (exports.MaintenanceStatus = MaintenanceStatus = {}));
var TransferStatus;
(function (TransferStatus) {
    TransferStatus["PENDING"] = "PENDING";
    TransferStatus["APPROVED"] = "APPROVED";
    TransferStatus["REJECTED"] = "REJECTED";
    TransferStatus["COMPLETED"] = "COMPLETED";
})(TransferStatus || (exports.TransferStatus = TransferStatus = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["MAINTENANCE_DUE"] = "MAINTENANCE_DUE";
    NotificationType["AUDIT_REMINDER"] = "AUDIT_REMINDER";
    NotificationType["ASSET_ASSIGNED"] = "ASSET_ASSIGNED";
    NotificationType["TRANSFER_REQUEST"] = "TRANSFER_REQUEST";
    NotificationType["TRANSFER_APPROVED"] = "TRANSFER_APPROVED";
    NotificationType["TRANSFER_REJECTED"] = "TRANSFER_REJECTED";
    NotificationType["WARRANTY_EXPIRY"] = "WARRANTY_EXPIRY";
    NotificationType["SYSTEM"] = "SYSTEM";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var LocationType;
(function (LocationType) {
    LocationType["COMPANY"] = "COMPANY";
    LocationType["UNIT"] = "UNIT";
    LocationType["BLOCK"] = "BLOCK";
    LocationType["LINE"] = "LINE";
})(LocationType || (exports.LocationType = LocationType = {}));
//# sourceMappingURL=index.js.map