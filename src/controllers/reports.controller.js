import { Account, Journal } from "../models/accounting.model.js";
import { WashEntry } from "../models/wash-entry.model.js";
import { LedgerPayment } from "../models/ledger-payment.model.js";
import { CashBankTransaction } from "../models/cash-bank-transaction.model.js";
import { Expense } from "../models/expense.model.js";
import { SalaryTransaction } from "../models/salary.model.js";
import { Customer } from "../models/customer.model.js";
import { Employee } from "../models/employee.model.js";

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

// Get all accounts with their balances
async function getAccountBalances(fromDate, toDate) {
  const accounts = await Account.find().sort({ code: 1 }).lean();
  const journals = await Journal.find({
    status: "posted",
    ...(fromDate || toDate) && { date: { ...(fromDate && { $gte: fromDate }), ...(toDate && { $lte: toDate }) } }
  }).lean();

  const balances = {};
  for (const account of accounts) {
    balances[account._id] = {
      code: account.code,
      name: account.name,
      type: account.type,
      opening: account.openingBalance || 0,
      debit: 0,
      credit: 0
    };
  }

  for (const journal of journals) {
    for (const line of journal.lines || []) {
      if (balances[line.accountId]) {
        balances[line.accountId].debit += line.debit || 0;
        balances[line.accountId].credit += line.credit || 0;
      }
    }
  }

  for (const id in balances) {
    const bal = balances[id];
    if (bal.type === "asset" || bal.type === "expense") {
      bal.balance = bal.opening + bal.debit - bal.credit;
    } else {
      bal.balance = bal.opening + bal.credit - bal.debit;
    }
  }

  return balances;
}

export async function getTrialBalance(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;

    const balances = await getAccountBalances(fromDate, toDate);
    const lines = Object.values(balances).map(bal => ({
      code: bal.code,
      name: bal.name,
      type: bal.type,
      debit: bal.type === "asset" || bal.type === "expense" ? bal.balance : 0,
      credit: bal.type !== "asset" && bal.type !== "expense" ? bal.balance : 0
    }));

    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    res.json({
      report: "Trial Balance",
      fromDate,
      toDate,
      lines,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01
    });
  } catch (error) { next(error); }
}

export async function getProfitAndLoss(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;

    const balances = await getAccountBalances(fromDate, toDate);

    const incomes = Object.values(balances).filter(b => b.type === "income");
    const expenses = Object.values(balances).filter(b => b.type === "expense");

    const totalIncome = incomes.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpense = expenses.reduce((sum, acc) => sum + acc.balance, 0);
    const netProfit = totalIncome - totalExpense;

    res.json({
      report: "Profit & Loss Statement",
      fromDate,
      toDate,
      incomes: incomes.map(acc => ({ code: acc.code, name: acc.name, amount: acc.balance })),
      totalIncome,
      expenses: expenses.map(acc => ({ code: acc.code, name: acc.name, amount: acc.balance })),
      totalExpense,
      netProfit
    });
  } catch (error) { next(error); }
}

export async function getBalanceSheet(req, res, next) {
  try {
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();

    const balances = await getAccountBalances(null, toDate);

    const assets = Object.values(balances).filter(b => b.type === "asset");
    const liabilities = Object.values(balances).filter(b => b.type === "liability");
    const equity = Object.values(balances).filter(b => b.type === "equity");
    const incomes = Object.values(balances).filter(b => b.type === "income");
    const expenses = Object.values(balances).filter(b => b.type === "expense");

    const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
    const totalContributedEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);
    const totalIncome = incomes.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpense = expenses.reduce((sum, acc) => sum + acc.balance, 0);
    const netProfit = totalIncome - totalExpense;

    const totalEquity = totalContributedEquity + netProfit;

    const equityLines = equity.map(acc => ({ code: acc.code, name: acc.name, amount: acc.balance }));
    if (netProfit !== 0) {
      equityLines.push({ code: "RE-01", name: "Current Period Earnings / (Loss)", amount: netProfit });
    }

    res.json({
      report: "Balance Sheet",
      asOfDate: toDate,
      assets: assets.map(acc => ({ code: acc.code, name: acc.name, amount: acc.balance })),
      totalAssets,
      liabilities: liabilities.map(acc => ({ code: acc.code, name: acc.name, amount: acc.balance })),
      totalLiabilities,
      equity: equityLines,
      totalEquity,
      currentPeriodProfit: netProfit,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
    });
  } catch (error) { next(error); }
}

export async function getGeneralLedger(req, res, next) {
  try {
    const accountCode = req.query.accountCode;
    if (!accountCode) throw httpError(400, "Account code is required");

    const account = await Account.findOne({ code: accountCode });
    if (!account) throw httpError(404, "Account not found");

    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;

    const journals = await Journal.find({
      "lines.accountId": account._id,
      status: "posted",
      ...(fromDate || toDate) && { date: { ...(fromDate && { $gte: fromDate }), ...(toDate && { $lte: toDate }) } }
    }).populate("lines.accountId").sort({ date: 1 }).lean();

    let balance = account.openingBalance || 0;
    const lines = [];

    lines.push({
      date: account.createdAt,
      voucherNumber: "Opening Balance",
      debit: account.type === "asset" || account.type === "expense" ? balance : 0,
      credit: account.type !== "asset" && account.type !== "expense" ? balance : 0,
      balance
    });

    for (const journal of journals) {
      for (const line of journal.lines) {
        if (String(line.accountId._id) === String(account._id)) {
          if (account.type === "asset" || account.type === "expense") {
            balance = balance + (line.debit || 0) - (line.credit || 0);
          } else {
            balance = balance + (line.credit || 0) - (line.debit || 0);
          }
          lines.push({
            date: journal.date,
            voucherNumber: journal.voucherNumber,
            narration: journal.narration,
            debit: line.debit,
            credit: line.credit,
            balance
          });
        }
      }
    }

    res.json({
      report: "General Ledger",
      account: { code: account.code, name: account.name, type: account.type },
      fromDate,
      toDate,
      lines,
      closingBalance: balance
    });
  } catch (error) { next(error); }
}

export async function getDayBook(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : new Date();
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();

    const journals = await Journal.find({
      date: { $gte: fromDate, $lte: toDate },
      status: "posted"
    }).populate("lines.accountId", "code name type").sort({ date: 1 }).lean();

    const lines = [];
    let totalDebit = 0, totalCredit = 0;

    for (const journal of journals) {
      for (const line of journal.lines) {
        totalDebit += line.debit || 0;
        totalCredit += line.credit || 0;
        lines.push({
          date: journal.date,
          voucherNumber: journal.voucherNumber,
          voucherType: journal.voucherType,
          accountCode: line.accountId?.code,
          accountName: line.accountId?.name,
          narration: journal.narration,
          debit: line.debit || 0,
          credit: line.credit || 0,
          description: line.description
        });
      }
    }

    res.json({
      report: "Day Book",
      fromDate,
      toDate,
      lines,
      totalDebit,
      totalCredit
    });
  } catch (error) { next(error); }
}

export async function getCashBook(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;

    const cashAccount = await Account.findOne({ code: "1001" });
    if (!cashAccount) throw httpError(404, "Cash account not found");

    const journals = await Journal.find({
      "lines.accountId": cashAccount._id,
      status: "posted",
      ...(fromDate || toDate) && { date: { ...(fromDate && { $gte: fromDate }), ...(toDate && { $lte: toDate }) } }
    }).populate("lines.accountId").sort({ date: 1 }).lean();

    let balance = cashAccount.openingBalance || 0;
    const lines = [];

    lines.push({ date: new Date(), particulars: "Opening Balance", receipt: balance, payment: 0, balance });

    for (const journal of journals) {
      for (const line of journal.lines) {
        if (String(line.accountId._id) === String(cashAccount._id)) {
          balance = balance + (line.debit || 0) - (line.credit || 0);
          lines.push({
            date: journal.date,
            particulars: journal.narration,
            receipt: line.debit || 0,
            payment: line.credit || 0,
            balance
          });
        }
      }
    }

    res.json({
      report: "Cash Book",
      fromDate,
      toDate,
      lines,
      closingBalance: balance
    });
  } catch (error) { next(error); }
}

export async function getBankBook(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : null;
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;

    const bankAccount = await Account.findOne({ code: "1201" });
    if (!bankAccount) throw httpError(404, "Bank account not found");

    const journals = await Journal.find({
      "lines.accountId": bankAccount._id,
      status: "posted",
      ...(fromDate || toDate) && { date: { ...(fromDate && { $gte: fromDate }), ...(toDate && { $lte: toDate }) } }
    }).populate("lines.accountId").sort({ date: 1 }).lean();

    let balance = bankAccount.openingBalance || 0;
    const lines = [];

    lines.push({ date: new Date(), particulars: "Opening Balance", deposit: balance, withdrawal: 0, balance });

    for (const journal of journals) {
      for (const line of journal.lines) {
        if (String(line.accountId._id) === String(bankAccount._id)) {
          balance = balance + (line.debit || 0) - (line.credit || 0);
          lines.push({
            date: journal.date,
            particulars: journal.narration,
            deposit: line.debit || 0,
            withdrawal: line.credit || 0,
            balance
          });
        }
      }
    }

    res.json({
      report: "Bank Book",
      fromDate,
      toDate,
      lines,
      closingBalance: balance
    });
  } catch (error) { next(error); }
}

export async function getSalaryReport(req, res, next) {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const [employees, transactions] = await Promise.all([
      Employee.find({ status: "active" }).lean(),
      SalaryTransaction.find({ month }).lean()
    ]);

    const lines = employees.map((employee) => {
      const tx = transactions.filter((t) => String(t.employeeId) === String(employee._id));
      const advances = tx.filter((t) => t.type === "advance").reduce((sum, t) => sum + t.amount, 0);
      const paid = tx.filter((t) => t.type === "salary").reduce((sum, t) => sum + t.amount, 0);
      return {
        employeeCode: employee._id,
        employeeName: employee.name,
        mobileNumber: employee.mobileNumber,
        monthlySalary: employee.monthlySalary,
        advances,
        paid,
        remaining: Math.max(0, employee.monthlySalary - paid)
      };
    });

    const totals = {
      monthlySalary: lines.reduce((sum, line) => sum + line.monthlySalary, 0),
      advances: lines.reduce((sum, line) => sum + line.advances, 0),
      paid: lines.reduce((sum, line) => sum + line.paid, 0),
      remaining: lines.reduce((sum, line) => sum + line.remaining, 0)
    };

    res.json({
      report: "Salary Register",
      month,
      lines,
      totals
    });
  } catch (error) { next(error); }
}

export async function getExpenseReport(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();

    const expenses = await Expense.find({
      expenseDate: { $gte: fromDate, $lte: toDate }
    }).sort({ expenseDate: 1 }).lean();

    const byCategory = {};
    expenses.forEach(exp => {
      if (!byCategory[exp.category]) {
        byCategory[exp.category] = { count: 0, amount: 0, items: [] };
      }
      byCategory[exp.category].count++;
      byCategory[exp.category].amount += exp.amount;
      byCategory[exp.category].items.push({
        date: exp.expenseDate,
        description: exp.description,
        amount: exp.amount,
        paymentMode: exp.paymentMode
      });
    });

    const lines = Object.entries(byCategory).map(([category, data]) => ({
      category,
      count: data.count,
      amount: data.amount,
      avgAmount: data.amount / data.count
    }));

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    res.json({
      report: "Expense Report",
      fromDate,
      toDate,
      byCategory: lines,
      totalExpense: totalAmount,
      details: expenses
    });
  } catch (error) { next(error); }
}

export async function getWashTypeWiseReport(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();

    const entries = await WashEntry.find({
      entryDate: { $gte: fromDate, $lte: toDate },
      status: { $ne: "cancelled" }
    }).populate("washTypeId").lean();

    const byWashType = {};
    entries.forEach(entry => {
      const washType = entry.washTypeId?.name || "Unknown";
      if (!byWashType[washType]) {
        byWashType[washType] = { count: 0, totalAmount: 0, immediate: 0, credit: 0 };
      }
      byWashType[washType].count++;
      byWashType[washType].totalAmount += entry.savedRate;
      if (entry.paymentType === "immediate") byWashType[washType].immediate++;
      else byWashType[washType].credit++;
    });

    const lines = Object.entries(byWashType).map(([washType, data]) => ({
      washType,
      count: data.count,
      totalAmount: data.totalAmount,
      avgAmount: data.totalAmount / data.count,
      immediate: data.immediate,
      credit: data.credit
    }));

    const totals = {
      count: entries.length,
      totalAmount: entries.reduce((sum, e) => sum + e.savedRate, 0),
      immediate: entries.filter(e => e.paymentType === "immediate").length,
      credit: entries.filter(e => e.paymentType === "credit").length
    };

    res.json({
      report: "Wash Type-wise Report",
      fromDate,
      toDate,
      byWashType: lines,
      totals
    });
  } catch (error) { next(error); }
}

export async function getCustomerWiseReport(req, res, next) {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();

    const entries = await WashEntry.find({
      entryDate: { $gte: fromDate, $lte: toDate },
      status: { $ne: "cancelled" }
    }).populate("customerId").lean();

    const byCustomer = {};
    entries.forEach(entry => {
      const custId = entry.customerId._id;
      if (!byCustomer[custId]) {
        byCustomer[custId] = {
          customerName: entry.customerId.name,
          count: 0,
          totalAmount: 0,
          payments: 0
        };
      }
      byCustomer[custId].count++;
      byCustomer[custId].totalAmount += entry.savedRate;
    });

    const payments = await LedgerPayment.find({
      paymentDate: { $gte: fromDate, $lte: toDate }
    }).lean();

    payments.forEach(payment => {
      if (byCustomer[payment.customerId]) {
        byCustomer[payment.customerId].payments += payment.amount;
      }
    });

    const lines = Object.values(byCustomer).map(data => ({
      customerName: data.customerName,
      count: data.count,
      totalAmount: data.totalAmount,
      payments: data.payments,
      outstanding: data.totalAmount - data.payments
    }));

    res.json({
      report: "Customer-wise Report",
      fromDate,
      toDate,
      lines,
      summary: {
        customers: lines.length,
        totalWashes: lines.reduce((sum, l) => sum + l.count, 0),
        totalAmount: lines.reduce((sum, l) => sum + l.totalAmount, 0),
        totalPayments: lines.reduce((sum, l) => sum + l.payments, 0),
        totalOutstanding: lines.reduce((sum, l) => sum + l.outstanding, 0)
      }
    });
  } catch (error) { next(error); }
}
