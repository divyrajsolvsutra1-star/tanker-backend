import mongoose from "mongoose";

export const PERMISSION_MODULES = [
  "dashboard",
  "customers",
  "vehicles",
  "washTypesRates",
  "washEntries",
  "washStatuses",
  "receipts",
  "customerLedger",
  "cashBank",
  "expenses",
  "employees",
  "accounting",
  "reports",
  "userManagement",
  "auditLogs",
  "backups",
];

export const PERMISSION_ACTIONS = [
  "read",
  "create",
  "update",
  "deactivate",
  "approve",
  "export",
];

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["manager", "entry_operator", "accountant", "washer"],
      required: true,
      unique: true,
    },
    permissions: {
      type: Map,
      of: [String],
      default: {},
    },
  },
  { timestamps: true },
);

export const RolePermission =
  mongoose.models.RolePermission ??
  mongoose.model("RolePermission", rolePermissionSchema);
