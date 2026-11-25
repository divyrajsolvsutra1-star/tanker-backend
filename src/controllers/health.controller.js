import { getDatabaseStatus } from "../config/database.js";

export function getHealth(_req, res) {
  res.status(200).json({
    status: "ok",
    service: "tanker-backend",
    database: {
      status: getDatabaseStatus(),
    },
    timestamp: new Date().toISOString(),
  });
}
