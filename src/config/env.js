import "dotenv/config";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

export const env = Object.freeze({
  port,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  mongoUri:
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/tanker_wash",
  mongoServerSelectionTimeoutMs: 5000,
  sessionDurationMs: 8 * 60 * 60 * 1000,
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY ?? "",
  nodeEnv: process.env.NODE_ENV ?? "development",
});
