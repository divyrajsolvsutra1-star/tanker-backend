import { Expense } from "../models/expense.model.js";
import { Account, Journal } from "../models/accounting.model.js";
import { CashBankTransaction } from "../models/cash-bank-transaction.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { ensureDefaultAccounts } from "../config/seed-defaults.js";
import { nextSequentialCode } from "../utils/sequence.js";

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

async function postExpenseJournal({ req, expense, narration }) {
  await ensureDefaultAccounts();
  const expenseAccount = await Account.findOne({ code: "5001" });
  const cashOrBankAccount = await Account.findOne({ code: expense.paymentMode === "cash" ? "1001" : "1201" });
  if (!expenseAccount || !cashOrBankAccount) throw httpError(500, "Required accounting accounts are unavailable.");
  const voucherNumber = await nextSequentialCode(Journal, "voucherNumber", `JV-${new Date().getFullYear()}`, 6);
  return Journal.create({
    voucherNumber,
    voucherType: "journal",
    date: expense.expenseDate,
    lines: [
      { accountId: expenseAccount._id, debit: expense.amount, description: narration },
      { accountId: cashOrBankAccount._id, credit: expense.amount, description: narration },
    ],
    narration,
    referenceType: "Expense",
    referenceId: expense._id,
    status: "posted",
    createdBy: req.auth?._id,
  });
}

export async function listExpenses(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ category: { $regex: escaped, $options: "i" } }, { description: { $regex: escaped, $options: "i" } }];
    }
    const [items, total] = await Promise.all([
      Expense.find(filter).populate("accountId").sort({ expenseDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Expense.countDocuments(filter),
    ]);
    res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
}

export async function getExpense(req, res, next) {
  try {
    const item = await Expense.findById(req.params.id).populate("accountId").lean();
    if (!item) throw httpError(404, "Expense not found.");
    res.json({ item });
  } catch (error) { next(error); }
}

export async function createExpense(req, res, next) {
  try {
    const body = req.body ?? {};
    if (!body.category || !Number(body.amount) || Number(body.amount) <= 0) {
      throw httpError(400, "Category and a positive amount are required.");
    }
    if (!["cash", "upi", "bank"].includes(body.paymentMode)) throw httpError(400, "A valid payment mode is required.");
    if (["bank", "upi"].includes(body.paymentMode) && !body.accountId) {
      throw httpError(400, "A bank account is required for bank or UPI expenses.");
    }

    const expense = await Expense.create({
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
      category: body.category,
      description: body.description,
      amount: Number(body.amount),
      paymentMode: body.paymentMode,
      accountId: body.paymentMode === "cash" ? undefined : body.accountId,
      attachmentUrl: body.attachmentUrl,
      createdBy: req.auth?._id,
    });

    const narration = `${expense.category} expense`;
    await postExpenseJournal({ req, expense, narration });
    await CashBankTransaction.create({
      type: expense.paymentMode === "cash" ? "cash_out" : "bank_out",
      amount: expense.amount,
      transactionDate: expense.expenseDate,
      description: narration,
      fromAccountId: expense.paymentMode === "cash" ? undefined : expense.accountId,
      referenceType: "Expense",
      referenceId: expense._id,
      createdBy: req.auth?._id,
    });
    await AuditLog.create({ userId: req.auth?._id, action: "create", entityType: "Expense", entityId: expense._id, changes: expense.toObject(), ipAddress: req.ip });

    res.status(201).json({ item: expense });
  } catch (error) { next(error); }
}

export async function updateExpense(req, res, next) {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw httpError(404, "Expense not found.");
    const body = req.body ?? {};
    const financialFields = ["amount", "paymentMode", "accountId", "category", "expenseDate"];
    const changedFinancialField = financialFields.find(
      (field) => body[field] !== undefined && String(body[field]) !== String(expense[field] ?? ""),
    );
    if (changedFinancialField) {
      throw httpError(400, "Financial details cannot be edited after an expense is posted. Delete and recreate it instead.");
    }
    if (body.description !== undefined) expense.description = body.description;
    if (body.attachmentUrl !== undefined) expense.attachmentUrl = body.attachmentUrl;
    await expense.save();
    await AuditLog.create({ userId: req.auth?._id, action: "update", entityType: "Expense", entityId: expense._id, changes: expense.toObject(), ipAddress: req.ip });
    res.json({ item: expense });
  } catch (error) { next(error); }
}

export async function removeExpense(req, res, next) {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw httpError(404, "Expense not found.");

    await Journal.deleteMany({ referenceType: "Expense", referenceId: expense._id });
    await CashBankTransaction.deleteMany({ referenceType: "Expense", referenceId: expense._id });
    await AuditLog.deleteMany({ entityType: "Expense", entityId: expense._id });
    await expense.deleteOne();

    res.status(204).end();
  } catch (error) { next(error); }
}
