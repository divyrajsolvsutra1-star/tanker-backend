import { WashEntry } from "../models/wash-entry.model.js";
import { LedgerPayment } from "../models/ledger-payment.model.js";

/**
 * Real outstanding balance for a customer: opening balance + unpaid CREDIT wash
 * entries - payments received (allocated + unallocated/advance). Immediate
 * (cash/UPI/bank) entries are settled at the counter and never create a
 * receivable, so they are intentionally excluded.
 */
export async function getCustomerOutstanding(customerId, openingBalance = 0) {
  const [creditEntries, payments] = await Promise.all([
    WashEntry.find({ customerId, paymentType: "credit", status: { $ne: "cancelled" } })
      .select("savedRate")
      .lean(),
    LedgerPayment.find({ customerId }).select("amount").lean(),
  ]);
  const totalCreditWash = creditEntries.reduce((sum, entry) => sum + entry.savedRate, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return Number(openingBalance || 0) + totalCreditWash - totalPaid;
}
