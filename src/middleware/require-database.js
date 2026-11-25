import { getDatabaseStatus } from "../config/database.js";

export function requireDatabase(_req, res, next) {
  if (getDatabaseStatus() !== "connected") {
    return res.status(503).json({
      error: "Database is not connected. Start MongoDB or configure MONGODB_URI.",
    });
  }

  return next();
}
