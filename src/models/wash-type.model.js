import mongoose from "mongoose";

const washTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 300 },
  active: { type: Boolean, default: true },
  baseRate: { type: Number, default: 0, min: 0 },
  rates: [{ customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" }, amount: { type: Number, required: true, min: 0 }, updatedAt: { type: Date, default: Date.now }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } }]
}, { timestamps: true });
washTypeSchema.index({ name: 1 }, { unique: true });
export const WashType = mongoose.models.WashType ?? mongoose.model("WashType", washTypeSchema);
