import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema({
  bankName: { type: String, required: true, trim: true },
  accountName: { type: String, required: true, trim: true },
  accountNumber: { type: String, trim: true },
  ifsc: { type: String, trim: true, uppercase: true },
  openingBalance: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });
export const BankAccount = mongoose.models.BankAccount ?? mongoose.model("BankAccount", bankAccountSchema);
