import { env } from "../config/env.js";
import { AuthSession } from "../models/auth-session.model.js";
import { User } from "../models/user.model.js";
import {
  clearSessionCookie,
  setSessionCookie,
} from "../middleware/auth.js";
import {
  createMfaSetup,
  decryptMfaSecret,
  encryptMfaSecret,
  verifyMfaCode,
} from "../utils/mfa.js";
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
    const { email, password, code } = req.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof code !== "string"
    ) {
      throw httpError(400, "Email, password, and authenticator code are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail })
      .select("+passwordHash +mfaSecretEncrypted")
      .exec();

    if (
      !user ||
      user.status !== "active" ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw httpError(401, "Email or password is incorrect.");
    }

    if (
      !user.mfaSecretEncrypted ||
      !verifyMfaCode(decryptMfaSecret(user.mfaSecretEncrypted), code)
    ) {
      throw httpError(401, "Authenticator code is invalid.");
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
    }).select(
      "+invitationTokenHash +invitationExpiresAt +passwordHash +pendingMfaSecretEncrypted",
    );

    if (!user) {
      throw httpError(400, "Invitation is invalid or has expired.");
    }

    const setup = createMfaSetup(user.email);
    const setupToken = createOpaqueToken();
    const now = new Date();

    user.passwordHash = await hashPassword(password);
    user.pendingMfaSecretEncrypted = encryptMfaSecret(setup.secret);
    user.mfaSetupTokenHash = hashToken(setupToken);
    user.mfaSetupExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    user.invitationTokenHash = undefined;
    user.invitationExpiresAt = undefined;
    await user.save();

    return res.status(200).json({
      setupToken,
      otpauthUrl: setup.uri,
      manualSecret: setup.secret,
    });
  } catch (error) {
    return next(error);
  }
}

export async function confirmMfaEnrollment(req, res, next) {
  try {
    const { setupToken, code } = req.body ?? {};
    if (
      typeof setupToken !== "string" ||
      typeof code !== "string" ||
      !/^\d{6}$/.test(code)
    ) {
      throw httpError(400, "A setup token and six-digit authenticator code are required.");
    }

    const user = await User.findOne({
      mfaSetupTokenHash: hashToken(setupToken),
      mfaSetupExpiresAt: { $gt: new Date() },
      status: "invited",
    }).select(
      "+mfaSetupTokenHash +mfaSetupExpiresAt +pendingMfaSecretEncrypted +mfaSecretEncrypted",
    );

    if (!user || !user.pendingMfaSecretEncrypted) {
      throw httpError(400, "MFA setup is invalid or has expired.");
    }

    const secret = decryptMfaSecret(user.pendingMfaSecretEncrypted);
    if (!verifyMfaCode(secret, code)) {
      throw httpError(400, "Authenticator code is invalid.");
    }

    user.mfaSecretEncrypted = user.pendingMfaSecretEncrypted;
    user.pendingMfaSecretEncrypted = undefined;
    user.mfaSetupTokenHash = undefined;
    user.mfaSetupExpiresAt = undefined;
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
