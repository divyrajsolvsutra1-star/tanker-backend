import { env } from "../config/env.js";
import { AuthSession } from "../models/auth-session.model.js";
import { User } from "../models/user.model.js";
import {
  clearSessionCookie,
  setSessionCookie,
} from "../middleware/auth.js";
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  validatePassword,
  verifyPassword,
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
  };
}

async function createSession(user, res) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + env.sessionDurationMs);

  await AuthSession.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt,
  });
  setSessionCookie(res, token);

  return { user: publicUser(user), expiresAt: expiresAt.toISOString() };
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      throw httpError(400, "Email and password are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash").exec();

    if (
      !user ||
      user.status !== "active" ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw httpError(401, "Email or password is incorrect.");
    }

    return res.json(await createSession(user, res));
  } catch (error) {
    return next(error);
  }
}

export async function acceptInvitation(req, res, next) {
  try {
    const { token, password } = req.body ?? {};
    if (
      typeof token !== "string" ||
      !token ||
      !validatePassword(password)
    ) {
      throw httpError(
        400,
        "A valid invitation token and a 12-128 character password are required.",
      );
    }

    const user = await User.findOne({
      invitationTokenHash: hashToken(token),
      invitationExpiresAt: { $gt: new Date() },
      status: "invited",
    }).select("+invitationTokenHash +invitationExpiresAt +passwordHash");

    if (!user) {
      throw httpError(400, "Invitation is invalid or has expired.");
    }

    user.passwordHash = await hashPassword(password);
    user.invitationTokenHash = undefined;
    user.invitationExpiresAt = undefined;
    user.pendingMfaSecretEncrypted = undefined;
    user.mfaSetupTokenHash = undefined;
    user.mfaSetupExpiresAt = undefined;
    user.mfaSecretEncrypted = undefined;
    user.status = "active";
    await user.save();

    return res.status(201).json(await createSession(user, res));
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentUser(req, res) {
  return res.json({ user: publicUser(req.auth) });
}

export async function logout(req, res, next) {
  try {
    if (req.authSessionId) {
      await AuthSession.deleteOne({ _id: req.authSessionId });
    }

    clearSessionCookie(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
