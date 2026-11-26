import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: ["booked","washing","completed","delivered","cancelled"], required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  changedAt: { type: Date, default: Date.now },
  note: { type: String, trim: true, maxlength: 500 }
}, { _id: true });

const washEntrySchema = new mongoose.Schema({
  entryNumber: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  washTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "WashType", required: true },
  employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
  driverName: { type: String, trim: true, maxlength: 200 },
  driverMobileNumber: { type: String, trim: true, maxlength: 30 },
  savedRate: { type: Number, required: true, min: 0 },
  rateModified: { type: Boolean, default: false },
  rateModificationHistory: [{ amount: Number, modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, modifiedAt: { type: Date, default: Date.now }, reason: String }],
  paymentType: { type: String, enum: ["immediate","credit"], required: true },
  paymentMethod: { type: String, enum: ["cash","upi","bank"] },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
  status: { type: String, enum: ["booked","washing","completed","delivered","cancelled"], default: "booked" },
  statusHistory: [statusHistorySchema],
  creditApprovalStatus: { type: String, enum: ["not_required","pending","approved","rejected"], default: "not_required" },
  creditApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  entryDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
washEntrySchema.index({ customerId: 1, entryDate: -1 });
washEntrySchema.index({ vehicleId: 1, entryDate: -1 });
washEntrySchema.index({ status: 1, entryDate: -1 });
export const WashEntry = mongoose.models.WashEntry ?? mongoose.model("WashEntry", washEntrySchema);
