import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/require-database.js";
import { createCrudController } from "../controllers/crud.controller.js";
import { Customer } from "../models/customer.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { createVehicle, updateVehicle } from "../controllers/vehicle.controller.js";
import { WashType } from "../models/wash-type.model.js";
import { Employee } from "../models/employee.model.js";
import { Expense } from "../models/expense.model.js";
import { ExpenseCategory } from "../models/expense-category.model.js";
import { BankAccount } from "../models/bank-account.model.js";
import { WashEntry } from "../models/wash-entry.model.js";
import { SalaryTransaction } from "../models/salary.model.js";
import { Settings } from "../models/settings.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import {
  createWashEntry,
  deleteWashEntry,
  listWashEntries,
  updateWashStatus,
} from "../controllers/wash.controller.js";
import { getDashboard } from "../controllers/dashboard.controller.js";
import {
  createCustomerPayment,
  listCustomerPayments,
  getCustomerLedger,
  getSalaryRegister,
  createSalaryTransaction,
  listAccounting,
  listCashBankTransactions,
  createCashBankTransfer,
} from "../controllers/finance.controller.js";
import {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  removeExpense,
} from "../controllers/expense.controller.js";
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getGeneralLedger,
  getDayBook,
  getCashBook,
  getBankBook,
  getSalaryReport,
  getExpenseReport,
  getWashTypeWiseReport,
  getCustomerWiseReport
} from "../controllers/reports.controller.js";
import { exportReport, listExportFormats } from "../controllers/export.controller.js";
import { CashBankTransaction } from "../models/cash-bank-transaction.model.js";
import { LedgerPayment } from "../models/ledger-payment.model.js";

const router = Router();
router.use(requireDatabase, requireAuth);

  function addCrud(path, Model, moduleName, searchFields, references = [], overrides = {}) {
    const c = createCrudController(Model, searchFields, references);
    router.get(path, requirePermission(moduleName, "read"), overrides.list || c.list);
    router.get(`${path}/:id`, requirePermission(moduleName, "read"), overrides.get || c.get);
    router.post(path, requirePermission(moduleName, "create"), overrides.create || c.create);
    router.put(`${path}/:id`, requirePermission(moduleName, "update"), overrides.update || c.update);
    router.delete(`${path}/:id`, requirePermission(moduleName, "delete"), overrides.remove || c.remove);
  }

  router.get("/dashboard", requirePermission("dashboard", "read"), getDashboard);
  addCrud(
    "/customers",
    Customer,
    "customers",
    ["name", "ownerName", "contactPerson", "mobileNumber", "gstNumber"],
    [
      { model: Vehicle, field: "customerId", label: "vehicles" },
      { model: WashType, field: "rates.customerId", label: "wash-type rates" },
      { model: WashEntry, field: "customerId", label: "wash entries" },
      { model: LedgerPayment, field: "customerId", label: "ledger payments" },
    ],
  );
  addCrud(
    "/vehicles",
    Vehicle,
    "vehicles",
    ["vehicleNumber", "driverName", "driverMobileNumber"],
    [{ model: WashEntry, field: "vehicleId", label: "wash entries" }],
    { create: createVehicle, update: updateVehicle },
  );
  addCrud(
    "/wash-types",
    WashType,
    "washTypesRates",
    ["name", "description"],
    [{ model: WashEntry, field: "washTypeId", label: "wash entries" }],
  );
  addCrud(
    "/employees",
    Employee,
    "employees",
    ["name", "mobileNumber", "address"],
    [
      { model: WashEntry, field: "employeeIds", label: "wash entries" },
      { model: SalaryTransaction, field: "employeeId", label: "salary transactions" },
    ],
  );
  router.get("/expenses", requirePermission("expenses", "read"), listExpenses);
  router.get("/expenses/:id", requirePermission("expenses", "read"), getExpense);
  router.post("/expenses", requirePermission("expenses", "create"), createExpense);
  router.put("/expenses/:id", requirePermission("expenses", "update"), updateExpense);
  router.delete("/expenses/:id", requirePermission("expenses", "delete"), removeExpense);
  addCrud(
    "/expense-categories",
    ExpenseCategory,
    "expenses",
    ["name", "description"],
  );
  addCrud(
    "/bank-accounts",
    BankAccount,
    "cashBank",
    ["bankName", "accountName", "accountNumber"],
    [
      { model: CashBankTransaction, field: "fromAccountId", label: "transfers from this account" },
      { model: CashBankTransaction, field: "toAccountId", label: "transfers to this account" },
      { model: LedgerPayment, field: "bankAccountId", label: "ledger payments" },
      { model: SalaryTransaction, field: "bankAccountId", label: "salary transactions" },
      { model: WashEntry, field: "bankAccountId", label: "wash entries" },
      { model: Expense, field: "accountId", label: "expenses" },
    ],
  );
  router.get("/settings", requirePermission("auditLogs", "read"), async (req, res, next) => {
    try { const items = await Settings.find().sort({ key: 1 }).lean(); res.json({ items }); } catch (error) { next(error); }
  });
  router.post("/settings", requirePermission("auditLogs", "update"), async (req, res, next) => {
    try {
      const { key, value } = req.body || {};
      if (!key) throw Object.assign(new Error("Setting key is required."), { status: 400 });
      const item = await Settings.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      res.json({ item });
    } catch (error) { next(error); }
  });
  router.get("/audit-logs", requirePermission("auditLogs", "read"), async (req, res, next) => {
    try {
      const items = await AuditLog.find().populate("userId", "displayName email").sort({ createdAt: -1 }).limit(500).lean();
      res.json({ items });
    } catch (error) { next(error); }
  });

  router.get("/wash-entries", requirePermission("washEntries", "read"), listWashEntries);
  router.post("/wash-entries", requirePermission("washEntries", "create"), createWashEntry);
  router.get("/wash-entries/:id", requirePermission("receipts", "read"), async (req, res, next) => {
    try {
      const item = await (await import("../models/wash-entry.model.js")).WashEntry.findById(req.params.id).populate("customerId vehicleId washTypeId employeeIds").lean();
      if (!item) throw Object.assign(new Error("Wash entry not found."), { status: 404 });
      res.json({ item });
    } catch (error) { next(error); }
  });
  router.patch("/wash-entries/:id/status", requirePermission("washStatuses", "update"), updateWashStatus);
  router.delete("/wash-entries/:id", requirePermission("washEntries", "delete"), deleteWashEntry);

  router.get("/ledger/payments", requirePermission("customerLedger", "read"), listCustomerPayments);
  router.post("/ledger/payments", requirePermission("customerLedger", "create"), createCustomerPayment);
  router.get("/ledger/:customerId", requirePermission("customerLedger", "read"), getCustomerLedger);

  router.get("/salary/register", requirePermission("employees", "read"), getSalaryRegister);
  router.post("/salary/transactions", requirePermission("employees", "create"), createSalaryTransaction);

  router.get("/accounting", requirePermission("accounting", "read"), listAccounting);

  router.get("/cash-bank/transactions", requirePermission("cashBank", "read"), listCashBankTransactions);
  router.post("/cash-bank/transactions", requirePermission("cashBank", "create"), createCashBankTransfer);

  router.get("/reports/wash", requirePermission("reports", "read"), async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.from || req.query.to) { filter.entryDate = {}; if (req.query.from) filter.entryDate.$gte = new Date(req.query.from); if (req.query.to) filter.entryDate.$lte = new Date(req.query.to); }
      if (req.query.customerId) filter.customerId = req.query.customerId;
      if (req.query.washTypeId) filter.washTypeId = req.query.washTypeId;
      const items = await (await import("../models/wash-entry.model.js")).WashEntry.find(filter).populate("customerId vehicleId washTypeId employeeIds").sort({ entryDate: -1 }).lean();
      res.setHeader("Content-Type", "application/json");
      res.json({ items, totals: { count: items.length, amount: items.reduce((sum, item) => sum + item.savedRate, 0) } });
    } catch (error) { next(error); }
  });

  router.get("/reports/trial-balance", requirePermission("reports", "read"), getTrialBalance);
  router.get("/reports/profit-loss", requirePermission("reports", "read"), getProfitAndLoss);
  router.get("/reports/balance-sheet", requirePermission("reports", "read"), getBalanceSheet);
  router.get("/reports/general-ledger", requirePermission("reports", "read"), getGeneralLedger);
  router.get("/reports/day-book", requirePermission("reports", "read"), getDayBook);
  router.get("/reports/cash-book", requirePermission("reports", "read"), getCashBook);
  router.get("/reports/bank-book", requirePermission("reports", "read"), getBankBook);
  router.get("/reports/salary", requirePermission("reports", "read"), getSalaryReport);
  router.get("/reports/expenses", requirePermission("reports", "read"), getExpenseReport);
  router.get("/reports/wash-type-wise", requirePermission("reports", "read"), getWashTypeWiseReport);
  router.get("/reports/customer-wise", requirePermission("reports", "read"), getCustomerWiseReport);

  router.post("/export", requirePermission("reports", "read"), exportReport);
  router.get("/export-formats", listExportFormats);

  export default router;
