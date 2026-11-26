import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["asset","liability","equity","income","expense"], required: true },
  openingBalance: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });
export const Account = mongoose.models.Account ?? mongoose.model("Account", accountSchema);

const lineSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  description: { type: String, trim: true }
}, { _id: false });

const journalSchema = new mongoose.Schema({
  voucherNumber: { type: String, required: true, unique: true },
  voucherType: { type: String, enum: ["receipt","payment","contra","journal","expense","adjustment"], required: true },
  date: { type: Date, default: Date.now },
  lines: { type: [lineSchema], required: true },
  narration: { type: String, trim: true, maxlength: 1000 },
  referenceType: { type: String },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "Journal" },
  status: { type: String, enum: ["posted","cancelled"], default: "posted" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
journalSchema.index({ date: -1, voucherType: 1 });
export const Journal = mongoose.models.Journal ?? mongoose.model("Journal", journalSchema);
