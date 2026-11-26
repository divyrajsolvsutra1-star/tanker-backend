import mongoose from "mongoose";

const cashBankTransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["cash_in","cash_out","bank_in","bank_out","cash_to_bank","bank_to_cash","bank_to_bank","upi_in"], required: true },
  amount: { type: Number, required: true, min: 0 },
  transactionDate: { type: Date, default: Date.now },
  description: { type: String, trim: true, maxlength: 500 },
  fromAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
  toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
  referenceType: { type: String },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "CashBankTransaction" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
cashBankTransactionSchema.index({ transactionDate: -1 });
export const CashBankTransaction = mongoose.models.CashBankTransaction ?? mongoose.model("CashBankTransaction", cashBankTransactionSchema);
