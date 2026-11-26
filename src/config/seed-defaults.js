import { Account } from "../models/accounting.model.js";
import { WashType } from "../models/wash-type.model.js";

export async function ensureDefaultAccounts() {
  const seeds = [
    { code: "1001", name: "Cash", type: "asset" },
    { code: "1101", name: "Receivable", type: "asset" },
    { code: "1201", name: "Bank", type: "asset" },
    { code: "2001", name: "Accounts Payable", type: "liability" },
    { code: "3001", name: "Owner Equity", type: "equity" },
    { code: "4001", name: "Wash Income", type: "income" },
    { code: "5001", name: "Operating Expenses", type: "expense" },
    { code: "5101", name: "Salary Expense", type: "expense" },
    { code: "6101", name: "Salary Advances", type: "asset" },
  ];

  for (const s of seeds) {
    await Account.updateOne(
      { code: s.code },
      { $setOnInsert: { ...s, openingBalance: 0, active: true } },
      { upsert: true }
    );
  }
}

export async function ensureDefaultWashTypes() {
  const standardTypes = [
    { name: "Normal Wash", description: "Standard exterior tanker body wash" },
    { name: "Detergent Wash", description: "Chemical detergent wash for greasy residue" },
    { name: "Uria Wash", description: "Specialized urea wash for chemical tankers" },
  ];

  for (const wt of standardTypes) {
    const existing = await WashType.findOne({ name: wt.name });
    if (!existing) {
      await WashType.create({ ...wt, active: true, rates: [] });
    }
  }
}

export async function initializeDefaults() {
  try {
    await ensureDefaultAccounts();
    await ensureDefaultWashTypes();
  } catch (err) {
    console.error("Warning: Could not initialize defaults:", err.message);
  }
}
