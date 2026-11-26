import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/require-database.js";
import { createCrudController } from "../controllers/crud.controller.js";
import { Customer } from "../models/customer.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { WashType } from "../models/wash-type.model.js";
import { Employee } from "../models/employee.model.js";
import { Expense } from "../models/expense.model.js";
import { BankAccount } from "../models/bank-account.model.js";
import { Settings } from "../models/settings.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { createWashEntry, listWashEntries, updateWashStatus } from "../controllers/wash.controller.js";
import { getDashboard } from "../controllers/dashboard.controller.js";
import {
  createCustomerPayment,
  listCustomerPayments,
  getCustomerLedger,
  getSalaryRegister,
  createSalaryTransaction,
  listAccounting
} from "../controllers/finance.controller.js";
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

function addCrud(path, Model, moduleName, searchFields) {
  const c = createCrudController(Model, searchFields);
  router.get(path, requirePermission(moduleName, "read"), c.list);
  router.get(`${path}/:id`, requirePermission(moduleName, "read"), c.get);
  router.post(path, requirePermission(moduleName, "create"), c.create);
  router.put(`${path}/:id`, requirePermission(moduleName, "update"), c.update);
  router.delete(`${path}/:id`, requirePermission(moduleName, "deactivate"), c.remove);
}

router.get("/dashboard", requirePermission("dashboard", "read"), getDashboard);
addCrud("/customers", Customer, "customers", ["name","ownerName","contactPerson","mobileNumber","gstNumber"]);
addCrud("/vehicles", Vehicle, "vehicles", ["vehicleNumber","driverName","driverMobileNumber"]);
addCrud("/wash-types", WashType, "washTypesRates", ["name","description"]);
addCrud("/employees", Employee, "employees", ["name","mobileNumber","address"]);
addCrud("/expenses", Expense, "expenses", ["category","description"]);
addCrud("/bank-accounts", BankAccount, "cashBank", ["bankName","accountName","accountNumber"]);
router.get("/settings", requirePermission("auditLogs","read"), async (req,res,next)=>{
  try{const items=await Settings.find().sort({key:1}).lean();res.json({items});}catch(error){next(error);}
});
router.post("/settings", requirePermission("auditLogs","update"), async (req,res,next)=>{
  try{
    const {key,value}=req.body||{};
    if(!key)throw Object.assign(new Error("Setting key is required."),{status:400});
    const item=await Settings.findOneAndUpdate({key},{$set:{value}}, {upsert:true,new:true,setDefaultsOnInsert:true});
    res.json({item});
  }catch(error){next(error);}
});
router.get("/audit-logs", requirePermission("auditLogs", "read"), async (req,res,next) => {
  try {
    const items = await AuditLog.find().populate("userId","displayName email").sort({createdAt:-1}).limit(500).lean();
    res.json({items});
  } catch (error) { next(error); }
});

router.get("/wash-entries", requirePermission("washEntries","read"), listWashEntries);
router.post("/wash-entries", requirePermission("washEntries","create"), createWashEntry);
router.get("/wash-entries/:id", requirePermission("receipts","read"), async (req,res,next)=>{
  try{
    const item=await (await import("../models/wash-entry.model.js")).WashEntry.findById(req.params.id).populate("customerId vehicleId washTypeId employeeIds").lean();
    if(!item)throw Object.assign(new Error("Wash entry not found."),{status:404});
    res.json({item});
  }catch(error){next(error);}
});
router.patch("/wash-entries/:id/status", requirePermission("washStatuses","update"), updateWashStatus);

router.get("/ledger/payments", requirePermission("customerLedger","read"), listCustomerPayments);
router.post("/ledger/payments", requirePermission("customerLedger","create"), createCustomerPayment);
router.get("/ledger/:customerId", requirePermission("customerLedger","read"), getCustomerLedger);

router.get("/salary/register", requirePermission("employees","read"), getSalaryRegister);
router.post("/salary/transactions", requirePermission("employees","create"), createSalaryTransaction);

router.get("/accounting", requirePermission("accounting","read"), listAccounting);

router.get("/cash-bank/transactions", requirePermission("cashBank","read"), async (req,res,next)=>{
  try {
    const filter={};
    if(req.query.type) filter.type=req.query.type;
    if(req.query.from||req.query.to){filter.transactionDate={};if(req.query.from)filter.transactionDate.$gte=new Date(req.query.from);if(req.query.to)filter.transactionDate.$lte=new Date(req.query.to);}
    const items=await CashBankTransaction.find(filter).populate("fromAccountId toAccountId").sort({transactionDate:-1}).lean();
    res.json({items});
  } catch(error){next(error);}
});

router.post("/cash-bank/transactions", requirePermission("cashBank","create"), async (req,res,next)=>{
  try{
    const body=req.body||{};
    if(!Number(body.amount)||Number(body.amount)<=0||!body.type) throw Object.assign(new Error("Valid transaction type and amount are required."),{status:400});
    const item=await CashBankTransaction.create({...body,createdBy:req.auth?._id});
    res.status(201).json({item});
  }catch(error){next(error);}
});

router.get("/reports/wash", requirePermission("reports","read"), async (req,res,next)=>{
  try{
    const filter={};
    if(req.query.from||req.query.to){filter.entryDate={};if(req.query.from)filter.entryDate.$gte=new Date(req.query.from);if(req.query.to)filter.entryDate.$lte=new Date(req.query.to);}
    if(req.query.customerId)filter.customerId=req.query.customerId;
    if(req.query.washTypeId)filter.washTypeId=req.query.washTypeId;
    const items=await (await import("../models/wash-entry.model.js")).WashEntry.find(filter).populate("customerId vehicleId washTypeId employeeIds").sort({entryDate:-1}).lean();
    res.setHeader("Content-Type","application/json");
    res.json({items,totals:{count:items.length,amount:items.reduce((sum,item)=>sum+item.savedRate,0)}});
  }catch(error){next(error);}
});

router.get("/reports/trial-balance", requirePermission("reports","read"), getTrialBalance);
router.get("/reports/profit-loss", requirePermission("reports","read"), getProfitAndLoss);
router.get("/reports/balance-sheet", requirePermission("reports","read"), getBalanceSheet);
router.get("/reports/general-ledger", requirePermission("reports","read"), getGeneralLedger);
router.get("/reports/day-book", requirePermission("reports","read"), getDayBook);
router.get("/reports/cash-book", requirePermission("reports","read"), getCashBook);
router.get("/reports/bank-book", requirePermission("reports","read"), getBankBook);
router.get("/reports/salary", requirePermission("reports","read"), getSalaryReport);
router.get("/reports/expenses", requirePermission("reports","read"), getExpenseReport);
router.get("/reports/wash-type-wise", requirePermission("reports","read"), getWashTypeWiseReport);
router.get("/reports/customer-wise", requirePermission("reports","read"), getCustomerWiseReport);

router.post("/export", requirePermission("reports","read"), exportReport);
router.get("/export-formats", listExportFormats);

export default router;
