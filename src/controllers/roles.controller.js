import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  RolePermission,
} from "../models/role-permission.model.js";
import { USER_ROLES } from "../models/user.model.js";

const CONFIGURABLE_ROLES = USER_ROLES.filter((role) => role !== "owner_admin");

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

export async function getRolePermissions(_req, res, next) {
  try {
    const policies = await RolePermission.find().lean();
    const byRole = new Map(
      policies.map((policy) => [
        policy.role,
        plainPermissions(policy.permissions),
      ]),
    );

    return res.json({
      modules: PERMISSION_MODULES,
      actions: PERMISSION_ACTIONS,
      roles: CONFIGURABLE_ROLES.map((role) => ({
        role,
        permissions: byRole.get(role) ?? {},
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateRolePermissions(req, res, next) {
  try {
    const { role } = req.params;
    if (!CONFIGURABLE_ROLES.includes(role)) {
      throw httpError(400, "This role cannot be configured.");
    }

    const permissions = normalizePermissions(req.body?.permissions);
    const policy = await RolePermission.findOneAndUpdate(
      { role },
      { $set: { permissions } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    return res.json({
      role: policy.role,
      permissions: plainPermissions(policy.permissions),
    });
  } catch (error) {
    return next(error);
  }
}
