import mongoose from "mongoose";
import { isValidMobile } from "../utils/validators.js";

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  mobileNumber: {
    type: String,
    trim: true,
    maxlength: 10,
    validate: { validator: isValidMobile, message: "Mobile number must be exactly 10 digits (starting 6-9)." },
  },
  address: { type: String, trim: true, maxlength: 500 },
  details: { type: String, trim: true, maxlength: 1000 },
  monthlySalary: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });
employeeSchema.index({ name: "text" });
export const Employee = mongoose.models.Employee ?? mongoose.model("Employee", employeeSchema);
