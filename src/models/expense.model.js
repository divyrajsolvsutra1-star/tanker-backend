import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  expenseDate: { type: Date, required: true, default: Date.now },
  category: { type: String, enum: ["Electricity","Water","Rent","Maintenance","Diesel / Fuel","Machinery Repair","Office Expenses","Other Expenses"], required: true },
  description: { type: String, trim: true, maxlength: 500 },
  amount: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, enum: ["cash","upi","bank"], required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
  attachmentUrl: { type: String, trim: true },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" },
  status: { type: String, enum: ["active","cancelled"], default: "active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
export const Expense = mongoose.models.Expense ?? mongoose.model("Expense", expenseSchema);
