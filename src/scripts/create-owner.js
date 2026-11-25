import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/user.model.js";
import { createOpaqueToken, hashToken } from "../utils/security.js";

async function createInitialOwner() {
  const [emailArgument, ...nameParts] = process.argv.slice(2);
  const displayName = nameParts.join(" ").trim();
  const email = emailArgument?.trim().toLowerCase();

  if (
    !email ||
    !displayName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    displayName.length > 100
  ) {
    throw new Error(
      'Usage: npm run create-owner -- owner@example.com "Owner Name"',
    );
  }

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
  });

  const token = createOpaqueToken();
  if (await User.exists({ role: "owner_admin", status: "active" })) {
    throw new Error("An active Owner/Admin already exists; bootstrap is disabled.");
  }

  const existingOwner = await User.findOne({ role: "owner_admin" }).select(
    "+invitationTokenHash +invitationExpiresAt",
  );
  if (existingOwner && existingOwner.email !== email) {
    throw new Error(
      `Owner/Admin setup is already pending for ${existingOwner.email}. Use that email to reissue its activation link.`,
    );
  }

  const owner =
    existingOwner ??
    new User({
      displayName,
      email,
      role: "owner_admin",
      status: "invited",
    });
  owner.displayName = displayName;
  owner.email = email;
  owner.invitationTokenHash = hashToken(token);
  owner.invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await owner.save();

  console.log(
    `Initial Owner/Admin created. Open this one-time link within 24 hours:\n${env.frontendUrl}/activate?token=${encodeURIComponent(token)}`,
  );
}

createInitialOwner()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
