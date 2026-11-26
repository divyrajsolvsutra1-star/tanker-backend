import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
export const Settings = mongoose.models.Settings ?? mongoose.model("Settings", settingsSchema);
