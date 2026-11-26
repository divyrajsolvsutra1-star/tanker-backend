import mongoose from "mongoose";

const salaryTransactionSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  type: { type: String, enum: ["advance","salary"], required: true },
  amount: { type: Number, required: true, min: 0 },
  month: { type: String, required: true },
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ["cash","bank"], required: true },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
export const SalaryTransaction = mongoose.models.SalaryTransaction ?? mongoose.model("SalaryTransaction", salaryTransactionSchema);
