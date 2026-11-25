import mongoose from "mongoose";

export const USER_ROLES = [
  "owner_admin",
  "manager",
  "entry_operator",
  "accountant",
  "washer",
];

const userSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: ["invited", "active", "disabled"],
      default: "invited",
      required: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    invitationTokenHash: {
      type: String,
      select: false,
    },
    invitationExpiresAt: {
      type: Date,
      select: false,
    },
    pendingMfaSecretEncrypted: {
      type: String,
      select: false,
    },
    mfaSetupTokenHash: {
      type: String,
      select: false,
    },
    mfaSetupExpiresAt: {
      type: Date,
      select: false,
    },
    mfaSecretEncrypted: {
      type: String,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1 });

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema);
