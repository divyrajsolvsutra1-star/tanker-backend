import mongoose from "mongoose";
import { env } from "../config/env.js";
import { RolePermission } from "../models/role-permission.model.js";
import { User } from "../models/user.model.js";
import { hashPassword } from "../utils/security.js";

const demoUsers = [
  {
    displayName: "Owner Admin",
    email: "admin@tanker.local",
    password: "Admin@123456",
    role: "owner_admin",
  },
  {
    displayName: "Manager User",
    email: "manager@tanker.local",
    password: "Manager@123456",
    role: "manager",
  },
  {
    displayName: "Entry Operator",
    email: "operator@tanker.local",
    password: "Operator@123456",
    role: "entry_operator",
  },
  {
    displayName: "Accountant User",
    email: "accountant@tanker.local",
    password: "Accountant@123456",
    role: "accountant",
  },
];

const rolePermissions = {
  manager: {
    dashboard: ["read"],
    customers: ["read", "create", "update"],
    vehicles: ["read", "create", "update"],
    washTypesRates: ["read"],
    washEntries: ["read", "create", "update", "approve"],
    washStatuses: ["read", "update"],
    receipts: ["read"],
    employees: ["read"],
    reports: ["read"],
  },
  entry_operator: {
    customers: ["read", "create"],
    vehicles: ["read", "create"],
    washTypesRates: ["read"],
    washEntries: ["read", "create"],
    washStatuses: ["read", "update"],
    receipts: ["read"],
    employees: ["read"],
  },
  accountant: {
    dashboard: ["read"],
    customerLedger: ["read", "create"],
    cashBank: ["read", "create"],
    expenses: ["read", "create"],
    employees: ["read", "create"],
    accounting: ["read"],
    reports: ["read", "export"],
  },
};

async function createDevelopmentUsers() {
  if (env.nodeEnv === "production") {
    throw new Error("Development demo accounts cannot be created in production.");
  }

  let databaseHost;
  try {
    databaseHost = new URL(env.mongoUri).hostname;
  } catch {
    throw new Error("MONGODB_URI must be a valid MongoDB connection URL.");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
    if (process.env.ALLOW_REMOTE_DEMO_SEED !== "true") {
      throw new Error(
        "Remote demo seeding requires ALLOW_REMOTE_DEMO_SEED=true and a non-production environment.",
      );
    }
  }

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
  });

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    await RolePermission.updateOne(
      { role },
      { $setOnInsert: { role, permissions } },
      { upsert: true },
    );
  }

  let created = 0;
  let skipped = 0;
  const createdUsers = [];
  for (const demoUser of demoUsers) {
    const existing = await User.findOne({ email: demoUser.email }).select("_id");
    if (existing) {
      skipped += 1;
      console.log(`Skipped existing account: ${demoUser.email}`);
      continue;
    }

    try {
      await User.create({
        displayName: demoUser.displayName,
        email: demoUser.email,
        role: demoUser.role,
        status: "active",
        passwordHash: await hashPassword(demoUser.password),
      });
      created += 1;
      createdUsers.push(demoUser);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      skipped += 1;
      console.log(`Skipped concurrently created account: ${demoUser.email}`);
    }
  }

  console.log(`Created ${created} demo accounts; skipped ${skipped} existing accounts.`);
  if (createdUsers.length === 0) {
    console.log("No passwords were changed; sign in with the existing account credentials.");
  }
  for (const { email, password } of createdUsers) {
    console.log(`  ${email} / ${password}`);
  }
}

createDevelopmentUsers()
  .catch((error) => {
    console.error(`Could not create development users: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
