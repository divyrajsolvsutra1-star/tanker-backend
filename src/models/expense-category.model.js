import mongoose from "mongoose";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Electricity",
  "Water",
  "Rent",
  "Maintenance",
  "Diesel / Fuel",
  "Machinery Repair",
  "Office Expenses",
  "Chemicals / Cleaning Supplies",
  "Tea & Refreshments",
  "Miscellaneous",
];

const expenseCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

expenseCategorySchema.index({ status: 1 });

export const ExpenseCategory =
  mongoose.models.ExpenseCategory ??
  mongoose.model("ExpenseCategory", expenseCategorySchema);
