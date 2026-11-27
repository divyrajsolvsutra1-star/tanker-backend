import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  RolePermission,
} from "../models/role-permission.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { User } from "../models/user.model.js";

const LEGACY_ROLES = [
  { role: "manager", name: "Manager" },
  { role: "entry_operator", name: "Entry Operator" },
  { role: "accountant", name: "Accountant" },
  { role: "washer", name: "Washer / Employee" },
];

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function normalizePermissions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError(400, "Permissions must be an object.");
  }

  const normalized = {};
  for (const [moduleName, actions] of Object.entries(input)) {
    if (
      !PERMISSION_MODULES.includes(moduleName) ||
      !Array.isArray(actions) ||
      actions.some((action) => !PERMISSION_ACTIONS.includes(action))
    ) {
      throw httpError(400, "Permission module or action is invalid.");
    }

    normalized[moduleName] = [...new Set(actions)];
  }

  return normalized;
}

function plainPermissions(permissions) {
  if (permissions instanceof Map) {
    return Object.fromEntries(
      [...permissions.entries()].map(([moduleName, actions]) => [
        moduleName,
        [...actions],
      ]),
    );
  }

  return permissions ?? {};
}

function displayRoleName(policy) {
  return (
    policy.name ??
    LEGACY_ROLES.find((role) => role.role === policy.role)?.name ??
    policy.role
      .split(/[_-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function normalizeRoleName(input) {
  if (
    typeof input !== "string" ||
    input.trim().length < 2 ||
    input.trim().length > 60
  ) {
    throw httpError(400, "Role name must be between 2 and 60 characters.");
  }
  return input.trim();
}

function roleKeyFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function ensureUniqueRoleName(name, exceptRole) {
  const policies = await RolePermission.find({
    role: { $ne: exceptRole ?? "owner_admin" },
  })
    .select("role name")
    .lean();
  const normalizedName = name.toLocaleLowerCase();
  if (policies.some((policy) => displayRoleName(policy).toLocaleLowerCase() === normalizedName)) {
    throw httpError(409, "A role with this name already exists.");
  }
}

export async function getRolePermissions(_req, res, next) {
  try {
    const assignedRoles = await User.distinct("role", {
      role: { $ne: "owner_admin" },
    });
    const knownRoles = new Map(
      LEGACY_ROLES.map((role) => [role.role, role.name]),
    );
    for (const role of assignedRoles) {
      if (!knownRoles.has(role)) {
        knownRoles.set(
          role,
          role
            .split(/[_-]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" "),
        );
      }
    }
    await Promise.all(
      [...knownRoles.entries()].map(([role, name]) =>
        RolePermission.updateOne(
          { role },
          { $setOnInsert: { role, name, permissions: {} } },
          { upsert: true },
        ),
      ),
    );

    const policies = await RolePermission.find({ role: { $ne: "owner_admin" } })
      .sort({ createdAt: 1, role: 1 })
      .lean();

    return res.json({
      modules: PERMISSION_MODULES,
      actions: PERMISSION_ACTIONS,
      roles: policies.map((policy) => ({
        role: policy.role,
        name: displayRoleName(policy),
        permissions: plainPermissions(policy.permissions),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createRole(req, res, next) {
  try {
    const name = normalizeRoleName(req.body?.name);
    await ensureUniqueRoleName(name);
    const role = roleKeyFromName(name);
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(role) || role === "owner_admin") {
      throw httpError(400, "Role name must produce a valid unique role key.");
    }

    const policy = await RolePermission.create({
      role,
      name,
      permissions: {},
    });
    return res.status(201).json({
      role: policy.role,
      name: displayRoleName(policy),
      permissions: plainPermissions(policy.permissions),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return next(httpError(409, "A role with this name already exists."));
    }
    return next(error);
  }
}

export async function updateRole(req, res, next) {
  try {
    const { role } = req.params;
    if (role === "owner_admin") {
      throw httpError(400, "The Owner/Admin role cannot be edited.");
    }

    const name = normalizeRoleName(req.body?.name);
    const policy = await RolePermission.findOne({ role });
    if (!policy) {
      throw httpError(404, "Role not found.");
    }
    await ensureUniqueRoleName(name, role);

    policy.name = name;
    await policy.save();
    return res.json({
      role: policy.role,
      name: displayRoleName(policy),
      permissions: plainPermissions(policy.permissions),
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteRole(req, res, next) {
  try {
    const { role } = req.params;
    if (role === "owner_admin") {
      throw httpError(400, "The Owner/Admin role cannot be deleted.");
    }

    const policy = await RolePermission.findOne({ role }).lean();
    if (!policy) {
      throw httpError(404, "Role not found.");
    }

    const assignedUsers = await User.countDocuments({ role });
    if (assignedUsers > 0) {
      throw httpError(
        409,
        `Cannot delete this role while ${assignedUsers} user(s) are assigned to it. Reassign or delete those users first.`,
      );
    }

    await RolePermission.deleteOne({ role });
    await AuditLog.create({
      userId: req.auth?._id,
      action: "delete",
      entityType: "Role",
      entityId: policy._id,
      changes: { role, name: displayRoleName(policy) },
      ipAddress: req.ip,
    });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

export async function updateRolePermissions(req, res, next) {
  try {
    const { role } = req.params;
    if (role === "owner_admin") {
      throw httpError(400, "The Owner/Admin role cannot be configured.");
    }

    const permissions = normalizePermissions(req.body?.permissions);
    const policy = await RolePermission.findOne({ role });
    if (!policy) {
      throw httpError(404, "Role not found.");
    }

    policy.permissions = permissions;
    await policy.save();
    return res.json({
      role: policy.role,
      name: displayRoleName(policy),
      permissions: plainPermissions(policy.permissions),
    });
  } catch (error) {
    return next(error);
  }
}
