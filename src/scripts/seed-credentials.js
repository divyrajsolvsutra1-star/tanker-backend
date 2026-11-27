import mongoose from "mongoose";
import "dotenv/config";
import { User } from "../models/user.model.js";
import { RolePermission } from "../models/role-permission.model.js";
import { hashPassword, verifyPassword } from "../utils/security.js";

const demoUsers = [
  { email: "admin@tanker.local", password: "Admin@123456", role: "owner_admin", displayName: "Owner Admin" },
  { email: "manager@tanker.local", password: "Manager@123456", role: "manager", displayName: "Manager User" },
  { email: "operator@tanker.local", password: "Operator@123456", role: "entry_operator", displayName: "Entry Operator" },
  { email: "accountant@tanker.local", password: "Accountant@123456", role: "accountant", displayName: "Accountant User" },
  { email: "washer@tanker.local", password: "Washer@123456", role: "washer", displayName: "Washer Staff" },
];

const rolePermissions = {
  manager: {
    dashboard: ["read"],
    customers: ["read", "create", "update"],
    vehicles: ["read", "create", "update"],
    washTypesRates: ["read", "update"],
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
  washer: {
    washEntries: ["read"],
    washStatuses: ["read", "update"],
  },
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    await RolePermission.updateOne(
      { role },
      { $set: { role, permissions } },
      { upsert: true }
    );
  }

  for (const u of demoUsers) {
    const passwordHash = await hashPassword(u.password);
    await User.findOneAndUpdate(
      { email: u.email },
      {
        $set: {
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          status: "active",
          passwordHash,
          mfaEnabled: false,
        },
      },
      { upsert: true, new: true }
    );

    const doc = await User.findOne({ email: u.email }).select("+passwordHash");
    const ok = await verifyPassword(u.password, doc.passwordHash);
    console.log(`User: ${u.email} | Role: ${u.role} | Password verified: ${ok}`);
  }

  await mongoose.disconnect();
  console.log("All credentials seeded and verified successfully.");
}

seed().catch(console.error);
