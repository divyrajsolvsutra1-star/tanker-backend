import { env } from "../config/env.js";
import { User, USER_ROLES } from "../models/user.model.js";
import { createOpaqueToken, hashToken } from "../utils/security.js";

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
    createdAt: user.createdAt,
  };
}

export async function listUsers(_req, res, next) {
  try {
    const users = await User.find()
      .select("displayName email role status createdAt")
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
      !USER_ROLES.includes(role)
    ) {
      throw httpError(400, "A valid name, email, and role are required.");
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
