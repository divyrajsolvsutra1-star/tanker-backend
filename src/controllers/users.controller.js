import mongoose from "mongoose";
import { env } from "../config/env.js";
import { AuditLog } from "../models/audit-log.model.js";
import { AuthSession } from "../models/auth-session.model.js";
import { RolePermission } from "../models/role-permission.model.js";
import { User } from "../models/user.model.js";
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  validatePassword,
} from "../utils/security.js";

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
  };
}

export async function listUsers(_req, res, next) {
  try {
    const users = await User.find()
      .select("displayName email role status mustChangePassword createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ users: users.map(publicUser) });
  } catch (error) {
    return next(error);
  }
}

export async function inviteUser(req, res, next) {
  try {
    const { displayName, email, role } = req.body ?? {};
    if (
      typeof displayName !== "string" ||
      displayName.trim().length < 2 ||
      displayName.trim().length > 100 ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof role !== "string"
    ) {
      throw httpError(400, "A valid name, email, and role are required.");
    }
    if (role !== "owner_admin" && !(await RolePermission.exists({ role }))) {
      throw httpError(400, "The selected role does not exist.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).select(
      "+invitationTokenHash +invitationExpiresAt +passwordHash +pendingMfaSecretEncrypted +mfaSetupTokenHash +mfaSetupExpiresAt +mfaSecretEncrypted",
    );
    if (existing && existing.status !== "invited") {
      throw httpError(409, "A user with this email already exists.");
    }

    const token = createOpaqueToken();
    const invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const user =
      existing ??
      new User({
        displayName: displayName.trim(),
        email: normalizedEmail,
        role,
        status: "invited",
      });

    user.displayName = displayName.trim();
    user.role = role;
    user.invitationTokenHash = hashToken(token);
    user.invitationExpiresAt = invitationExpiresAt;
    user.passwordHash = undefined;
    user.mfaSecretEncrypted = undefined;
    user.pendingMfaSecretEncrypted = undefined;
    user.mfaSetupTokenHash = undefined;
    user.mfaSetupExpiresAt = undefined;
    try {
      await user.save();
    } catch (error) {
      if (error?.code === 11000) {
        throw httpError(409, "A user with this email already exists.");
      }
      throw error;
    }

    return res.status(existing ? 200 : 201).json({
      user: publicUser(user),
      activationUrl: `${env.frontendUrl}/activate?token=${encodeURIComponent(token)}`,
      expiresAt: invitationExpiresAt.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body ?? {};
    if (!mongoose.isValidObjectId(id)) {
      throw httpError(400, "User ID is invalid.");
    }
    if (
      typeof role !== "string" ||
      (role !== "owner_admin" && !(await RolePermission.exists({ role })))
    ) {
      throw httpError(400, "The selected role does not exist.");
    }

    const user = await User.findById(id);
    if (!user) {
      throw httpError(404, "User not found.");
    }
    if (String(user._id) === String(req.auth?._id) && role !== "owner_admin") {
      throw httpError(400, "You cannot remove your own Owner/Admin access.");
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();
    await AuditLog.create({
      userId: req.auth?._id,
      action: "update",
      entityType: "User",
      entityId: user._id,
      changes: { before: { role: previousRole }, after: { role } },
      ipAddress: req.ip,
    });

    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function activateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { password } = req.body ?? {};
    if (!mongoose.isValidObjectId(id)) {
      throw httpError(400, "User ID is invalid.");
    }
    if (!validatePassword(password)) {
      throw httpError(400, "Password must be between 12 and 128 characters.");
    }

    const user = await User.findById(id).select(
      "+passwordHash +invitationTokenHash +invitationExpiresAt",
    );
    if (!user) {
      throw httpError(404, "User not found.");
    }
    if (!["invited", "disabled"].includes(user.status)) {
      throw httpError(409, "Only invited or disabled users can be activated.");
    }

    const previousStatus = user.status;
    user.passwordHash = await hashPassword(password);
    user.invitationTokenHash = undefined;
    user.invitationExpiresAt = undefined;
    user.status = "active";
    user.mustChangePassword = true;
    await user.save();
    await AuthSession.deleteMany({ userId: user._id });
    await AuditLog.create({
      userId: req.auth?._id,
      action: "activate",
      entityType: "User",
      entityId: user._id,
      changes: { before: { status: previousStatus }, after: { status: "active" } },
      ipAddress: req.ip,
    });

    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw httpError(400, "User ID is invalid.");
    }

    const user = await User.findById(id).lean();
    if (!user) {
      throw httpError(404, "User not found.");
    }
    if (String(user._id) === String(req.auth?._id)) {
      throw httpError(400, "You cannot delete your own account.");
    }

    await AuthSession.deleteMany({ userId: user._id });
    const deleted = await User.deleteOne({ _id: user._id });
    if (deleted.deletedCount !== 1) {
      throw httpError(404, "User not found.");
    }

    await AuditLog.create({
      userId: req.auth?._id,
      action: "delete",
      entityType: "User",
      entityId: user._id,
      changes: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      ipAddress: req.ip,
    });

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
