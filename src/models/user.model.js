import mongoose from "mongoose";

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
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["invited", "active", "disabled"],
      default: "invited",
      required: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
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
