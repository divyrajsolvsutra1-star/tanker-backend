import { env } from "../config/env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireSameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (!env.corsOrigins.includes(req.get("origin"))) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }

  return next();
}
