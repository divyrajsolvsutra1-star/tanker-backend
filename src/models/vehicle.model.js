import mongoose from "mongoose";
import { isValidMobile } from "../utils/validators.js";

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  driverName: { type: String, trim: true, maxlength: 200 },
  driverMobileNumber: {
    type: String,
    trim: true,
    maxlength: 10,
    validate: { validator: isValidMobile, message: "Driver mobile number must be exactly 10 digits (starting 6-9)." },
  },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });
vehicleSchema.index({ vehicleNumber: 1 }, { unique: true });
vehicleSchema.index({ customerId: 1 });
export const Vehicle = mongoose.models.Vehicle ?? mongoose.model("Vehicle", vehicleSchema);
