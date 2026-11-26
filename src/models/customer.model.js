import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  customerType: { type: String, enum: ["company", "individual"], required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  ownerName: { type: String, trim: true, maxlength: 200 },
  contactPerson: { type: String, trim: true, maxlength: 200 },
  mobileNumber: { type: String, trim: true, maxlength: 30 },
  gstNumber: { type: String, trim: true, uppercase: true, maxlength: 30 },
  address: { type: String, trim: true, maxlength: 500 },
  openingBalance: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0, min: 0 },
  creditPeriod: { type: Number, default: 0, min: 0 },
  paymentTerms: { type: String, enum: ["immediate", "15_days", "30_days", "other"], default: "immediate" },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });
customerSchema.index({ name: "text", mobileNumber: 1, gstNumber: 1 });
export const Customer = mongoose.models.Customer ?? mongoose.model("Customer", customerSchema);
