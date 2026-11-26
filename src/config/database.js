import mongoose from "mongoose";
import { env } from "./env.js";
import { initializeDefaults } from "./seed-defaults.js";

export async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
  });
  console.log("MongoDB connected.");
  await initializeDefaults();
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function getDatabaseStatus() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return states[mongoose.connection.readyState] ?? "unknown";
}
