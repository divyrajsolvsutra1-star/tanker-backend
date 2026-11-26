import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema({
  washEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "WashEntry", required: true },
  amount: { type: Number, required: true, min: 0 }
}, { _id: false });

const ledgerPaymentSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ["cash","upi","bank"], required: true },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
  allocations: [allocationSchema],
  unallocatedAmount: { type: Number, default: 0, min: 0 },
  paymentDate: { type: Date, default: Date.now },
  idempotencyKey: { type: String, trim: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
export const LedgerPayment = mongoose.models.LedgerPayment ?? mongoose.model("LedgerPayment", ledgerPaymentSchema);
