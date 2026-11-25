import { env } from "../config/env.js";
import { AuthSession } from "../models/auth-session.model.js";
import { RolePermission } from "../models/role-permission.model.js";
import { hashToken } from "../utils/security.js";

const SESSION_COOKIE = "tanker_session";

function readSessionToken(req) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const sessionCookie = cookies
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));

  return sessionCookie?.slice(SESSION_COOKIE.length + 1) ?? null;
}

export function setSessionCookie(res, token) {
  const attributes = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/api",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(env.sessionDurationMs / 1000)}`,
  ];

  if (env.nodeEnv === "production") attributes.push("Secure");
  res.append("Set-Cookie", attributes.join("; "));
}

export function clearSessionCookie(res) {
  const attributes = [
    `${SESSION_COOKIE}=`,
    "Path=/api",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (env.nodeEnv === "production") attributes.push("Secure");
  res.append("Set-Cookie", attributes.join("; "));
}

export async function requireAuth(req, res, next) {
  try {
    const token = readSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const session = await AuthSession.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    }).populate("userId", "displayName email role status");

    if (!session || !session.userId || session.userId.status !== "active") {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Authentication required." });
    }

    req.auth = session.userId;
    req.authSessionId = session._id;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireOwnerAdmin(req, res, next) {
  if (req.auth?.role !== "owner_admin") {
    return res.status(403).json({ error: "Owner/Admin permission required." });
  }

  return next();
}

export function requirePermission(moduleName, action) {
  return async function permissionMiddleware(req, res, next) {
    if (req.auth?.role === "owner_admin") return next();

    try {
      const policy = await RolePermission.findOne({ role: req.auth?.role }).lean();
      const permissions = policy?.permissions;
      const actions =
        permissions instanceof Map
          ? permissions.get(moduleName) ?? []
          : permissions?.[moduleName] ?? [];
      if (actions.includes(action)) return next();

      return res.status(403).json({ error: "Permission denied." });
    } catch (error) {
      return next(error);
    }
  };
}
