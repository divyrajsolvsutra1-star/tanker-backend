import mongoose from "mongoose";
import { isValidMobile } from "../utils/validators.js";

export function normalizeVehiclePlate(plate) {
  if (!plate) return "";
  return String(plate).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  normalizedNumber: { type: String, trim: true, uppercase: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  driverName: { type: String, trim: true, maxlength: 200 },
  driverMobileNumber: {
    type: String,
    trim: true,
    set: (v) => (v ? String(v).replace(/^\+91/, "").replace(/\D/g, "") : v),
    maxlength: 10,
    validate: { validator: isValidMobile, message: "Driver mobile number must be exactly 10 digits (starting 6-9)." },
  },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });

vehicleSchema.pre("validate", function () {
  if (this.vehicleNumber) {
    this.normalizedNumber = normalizeVehiclePlate(this.vehicleNumber);
  }
});

vehicleSchema.pre("save", function () {
  if (this.vehicleNumber) {
    this.normalizedNumber = normalizeVehiclePlate(this.vehicleNumber);
  }
});

vehicleSchema.index({ normalizedNumber: 1 }, { unique: true });
vehicleSchema.index({ vehicleNumber: 1 }, { unique: true });
vehicleSchema.index({ customerId: 1 });
export const Vehicle = mongoose.models.Vehicle ?? mongoose.model("Vehicle", vehicleSchema);
