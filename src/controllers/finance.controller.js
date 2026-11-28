import mongoose from "mongoose";
import { LedgerPayment } from "../models/ledger-payment.model.js";
import { WashEntry } from "../models/wash-entry.model.js";
import { Customer } from "../models/customer.model.js";
import { Account, Journal } from "../models/accounting.model.js";
import { CashBankTransaction } from "../models/cash-bank-transaction.model.js";
import { SalaryTransaction } from "../models/salary.model.js";
import { Employee } from "../models/employee.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { ensureDefaultAccounts } from "../config/seed-defaults.js";
import { nextSequentialCode } from "../utils/sequence.js";

function httpError(status,message){ return Object.assign(new Error(message),{status}); }

async function numberedVoucher(prefix, Model, field = "voucherNumber") {
  return nextSequentialCode(Model, field, `${prefix}-${new Date().getFullYear()}`, 6);
}

async function postJournal({req,voucherType,lines,narration,referenceType,referenceId}) {
  await ensureDefaultAccounts();
  const debit = lines.reduce((sum,line)=>sum+Number(line.debit||0),0);
  const credit = lines.reduce((sum,line)=>sum+Number(line.credit||0),0);
  if (Math.abs(debit-credit) > 0.001) throw httpError(400,"Journal voucher must balance.");
  const populated = [];
  for (const line of lines) {
    const account = await Account.findOne({code:line.accountCode});
    if (!account) throw httpError(400,`Accounting account ${line.accountCode} is missing.`);
    populated.push({accountId:account._id,debit:Number(line.debit||0),credit:Number(line.credit||0),description:line.description});
  }
  const journal = await Journal.create({
    voucherNumber:await numberedVoucher(voucherType==="receipt"?"RCV":voucherType==="payment"?"PAY":voucherType==="contra"?"CON":"JV",Journal),
    voucherType,
    date:new Date(),
    lines:populated,
    narration,
    referenceType,
    referenceId,
    status:"posted",
    createdBy:req.auth?._id
  });
  return journal;
}

export async function createCustomerPayment(req,res,next) {
  try {
    await ensureDefaultAccounts();
    const body=req.body||{};
    if (!body.customerId || !Number(body.amount) || Number(body.amount)<=0) throw httpError(400,"Customer and positive payment amount are required.");
    if (!["cash","upi","bank"].includes(body.paymentMethod)) throw httpError(400,"Valid payment method is required.");
    if (["bank","upi"].includes(body.paymentMethod)&&!body.bankAccountId) throw httpError(400,"Bank account is required.");
    if (body.idempotencyKey) {
      const existing=await LedgerPayment.findOne({idempotencyKey:body.idempotencyKey});
      if(existing){ return res.json({item:existing}); }
    }
    const customer=await Customer.findById(body.customerId);
    if(!customer||customer.status==="inactive") throw httpError(404,"Active customer not found.");
    const allocations=body.allocations||[];
    let allocated=0;
    for(const allocation of allocations){
      const entry=await WashEntry.findOne({_id:allocation.washEntryId,customerId:customer._id});
      if(!entry||entry.status==="cancelled") throw httpError(400,"Allocation wash entry is invalid.");
      const amount=Number(allocation.amount||0);
      if(amount<=0) throw httpError(400,"Allocation amounts must be positive.");
      allocated+=amount;
      const paymentHistory=await LedgerPayment.aggregate([{$match:{customerId:customer._id,"allocations.washEntryId":entry._id}},{$unwind:"$allocations"},{$match:{"allocations.washEntryId":entry._id}},{$group:{_id:null,total:{$sum:"$allocations.amount"}}}]);
      if(amount>(entry.savedRate-(paymentHistory[0]?.total||0))) throw httpError(400,"Allocation exceeds the outstanding wash amount.");
    }
    if(allocated>Number(body.amount)) throw httpError(400,"Allocated amount cannot exceed payment amount.");
    const unallocatedAmount=Number(body.amount)-allocated;
    const receiptNumber = await numberedVoucher("RCT", LedgerPayment, "receiptNumber");
    const payment = await LedgerPayment.create({
      receiptNumber,
      customerId:customer._id,
      amount:Number(body.amount),
      paymentMethod:body.paymentMethod,
      bankAccountId:body.bankAccountId,
      allocations,
      unallocatedAmount,
      paymentDate:body.paymentDate?new Date(body.paymentDate):new Date(),
      idempotencyKey:body.idempotencyKey,
      createdBy:req.auth?._id
    });
    const cashCode=body.paymentMethod==="cash"?"1001":"1201";
    await postJournal({req,voucherType:"receipt",lines:[{accountCode:cashCode,debit:Number(body.amount)},{accountCode:"1101",credit:Number(body.amount)}],narration:`Customer payment ${payment.receiptNumber}`,referenceType:"LedgerPayment",referenceId:payment._id});
    await CashBankTransaction.create({type:body.paymentMethod==="upi"?"upi_in":body.paymentMethod==="cash"?"cash_in":"bank_in",amount:Number(body.amount),transactionDate:payment.paymentDate,description:`Customer receipt ${payment.receiptNumber}`,toAccountId:body.bankAccountId,referenceType:"LedgerPayment",referenceId:payment._id,createdBy:req.auth?._id});
    await AuditLog.create({userId:req.auth?._id,action:"create",entityType:"LedgerPayment",entityId:payment._id,changes:payment.toObject(),ipAddress:req.ip});
    res.status(201).json({item:payment});
  } catch(error){next(error);}
}

export async function listCustomerPayments(req,res,next) {
  try {
    const filter={};
    if(req.query.customerId) filter.customerId=req.query.customerId;
    if(req.query.paymentMethod) filter.paymentMethod=req.query.paymentMethod;
    if(req.query.from||req.query.to){filter.paymentDate={};if(req.query.from)filter.paymentDate.$gte=new Date(req.query.from);if(req.query.to)filter.paymentDate.$lte=new Date(req.query.to);}
    const items=await LedgerPayment.find(filter).populate("customerId allocations.washEntryId").sort({paymentDate:-1}).lean();
    res.json({items});
  } catch(error){next(error);}
}

export async function getCustomerLedger(req,res,next) {
  try {
    const customer=await Customer.findById(req.params.customerId).lean();
    if(!customer)throw httpError(404,"Customer not found.");
    const [creditEntries,immediateEntries,payments] = await Promise.all([
      WashEntry.find({customerId:customer._id,paymentType:"credit",status:{$ne:"cancelled"}}).sort({entryDate:1}).lean(),
      WashEntry.find({customerId:customer._id,paymentType:"immediate",status:{$ne:"cancelled"}}).sort({entryDate:1}).lean(),
      LedgerPayment.find({customerId:customer._id}).sort({paymentDate:1}).lean()
    ]);
    const allocated=new Map();
    payments.forEach((payment)=>payment.allocations?.forEach((a)=>allocated.set(String(a.washEntryId), (allocated.get(String(a.washEntryId))||0)+a.amount)));
    const today=new Date();
    const pendingEntries=creditEntries.map((entry)=>{
      const outstanding=entry.savedRate-(allocated.get(String(entry._id))||0);
      return {...entry,outstanding,overdue:Boolean(entry.dueDate&&outstanding>0&&new Date(entry.dueDate)<today)};
    });

    const events=[
      ...creditEntries.map((entry)=>({date:entry.entryDate,type:"Wash Charge",reference:entry.entryNumber,debit:entry.savedRate,credit:0})),
      ...payments.map((payment)=>({date:payment.paymentDate,type:"Payment",reference:payment.receiptNumber,debit:0,credit:payment.amount})),
      ...immediateEntries.map((entry)=>({date:entry.entryDate,type:"Immediate Wash (Paid at Counter)",reference:entry.entryNumber,debit:0,credit:0})),
    ].sort((a,b)=>new Date(a.date)-new Date(b.date));

    let balance=customer.openingBalance||0;
    const lines=[{date:customer.createdAt,type:"Opening Balance",reference:"Opening",debit:customer.openingBalance||0,credit:0,balance}];
    events.forEach((event)=>{
      balance+=event.debit-event.credit;
      lines.push({...event,balance});
    });
    const advance=payments.reduce((sum,p)=>sum+(p.unallocatedAmount||0),0);
    const pending=pendingEntries.filter((e)=>e.outstanding>0);
    res.json({
      customer,
      lines,
      pendingEntries:pending,
      overdueEntries:pending.filter((e)=>e.overdue),
      advance,
      outstanding:balance,
      creditLimit:customer.creditLimit,
      creditPeriod:customer.creditPeriod,
      creditLimitApproaching:Number(customer.creditLimit)>0&&balance>=Number(customer.creditLimit)*0.8,
    });
  } catch(error){next(error);}
}

export async function getSalaryRegister(req,res,next){
  try{
    const month=req.query.month||new Date().toISOString().slice(0,7);
    const [employees,transactions]=await Promise.all([Employee.find({status:"active"}).lean(),SalaryTransaction.find({month}).lean()]);
    const rows=employees.map((employee)=>{
      const tx=transactions.filter((t)=>String(t.employeeId)===String(employee._id));
      const advances=tx.filter((t)=>t.type==="advance").reduce((sum,t)=>sum+t.amount,0);
      const paid=tx.filter((t)=>t.type==="salary").reduce((sum,t)=>sum+t.amount,0);
      return {employee,monthlySalary:employee.monthlySalary,advances,paid,remaining:Math.max(0,employee.monthlySalary-advances-paid)};
    });
    res.json({month,rows});
  }catch(error){next(error);}
}

export async function createSalaryTransaction(req,res,next){
  try{
    await ensureDefaultAccounts();
    const body=req.body||{};
    if(!body.employeeId||!body.month||!Number(body.amount)||!["advance","salary"].includes(body.type)||!["cash","bank"].includes(body.paymentMethod))throw httpError(400,"Valid employee, month, type, amount and payment method are required.");
    if(body.paymentMethod==="bank"&&!body.bankAccountId) throw httpError(400,"Bank account is required.");
    const employee=await Employee.findById(body.employeeId);
    if(!employee)throw httpError(404,"Employee not found.");
    if(body.type==="salary"){
      const allTx=await SalaryTransaction.find({employeeId:employee._id,month:body.month}).lean();
      const advances=allTx.filter((t)=>t.type==="advance").reduce((sum,t)=>sum+t.amount,0);
      const paid=allTx.filter((t)=>t.type==="salary").reduce((sum,t)=>sum+t.amount,0);
      const remaining=Math.max(0,employee.monthlySalary-advances-paid);
      if(Number(body.amount)>remaining) throw httpError(400,`Salary payment exceeds remaining balance (₹${remaining}) after advances.`);
    }
    const item=await SalaryTransaction.create({...body,createdBy:req.auth?._id});
    await postJournal({req,voucherType:"payment",lines:[
      {accountCode:body.type==="advance"?"6101":"5101",debit:Number(body.amount)},
      {accountCode:body.paymentMethod==="cash"?"1001":"1201",credit:Number(body.amount)}
    ],narration:`${body.type==="advance"?"Salary advance":"Salary payment"} for ${employee.name}`,referenceType:"SalaryTransaction",referenceId:item._id});
    await CashBankTransaction.create({type:body.paymentMethod==="cash"?"cash_out":"bank_out",amount:Number(body.amount),transactionDate:body.paymentDate?new Date(body.paymentDate):new Date(),description:`${body.type} - ${employee.name}`,fromAccountId:body.paymentMethod==="bank"?body.bankAccountId:undefined,referenceType:"SalaryTransaction",referenceId:item._id,createdBy:req.auth?._id});
    res.status(201).json({item});
  }catch(error){next(error);}
}

export async function listAccounting(req,res,next){
  try{
    await ensureDefaultAccounts();
    const [accounts,journals]=await Promise.all([Account.find().sort({code:1}).lean(),Journal.find().populate("lines.accountId","code name").sort({date:-1}).lean()]);
    res.json({accounts,journals});
  }catch(error){next(error);}
}

export async function listCashBankTransactions(req,res,next){
  try{
    const filter={};
    if(req.query.type) filter.type=req.query.type;
    if(req.query.accountId) filter.$or=[{fromAccountId:req.query.accountId},{toAccountId:req.query.accountId}];
    if(req.query.from||req.query.to){filter.transactionDate={};if(req.query.from)filter.transactionDate.$gte=new Date(req.query.from);if(req.query.to)filter.transactionDate.$lte=new Date(req.query.to);}
    const items=await CashBankTransaction.find(filter).populate("fromAccountId toAccountId").sort({transactionDate:-1}).lean();
    res.json({items});
  } catch(error){next(error);}
}

const TRANSFER_TYPES = ["cash_to_bank","bank_to_cash","bank_to_bank"];

export async function createCashBankTransfer(req,res,next){
  try{
    await ensureDefaultAccounts();
    const body=req.body||{};
    const amount=Number(body.amount);
    if(!TRANSFER_TYPES.includes(body.type)) throw httpError(400,"Valid transfer type is required (cash_to_bank, bank_to_cash or bank_to_bank).");
    if(!Number.isFinite(amount)||amount<=0) throw httpError(400,"A positive transfer amount is required.");
    if(body.type==="cash_to_bank"&&!body.toAccountId) throw httpError(400,"Destination bank account is required.");
    if(body.type==="bank_to_cash"&&!body.fromAccountId) throw httpError(400,"Source bank account is required.");
    if(body.type==="bank_to_bank"){
      if(!body.fromAccountId||!body.toAccountId) throw httpError(400,"Both source and destination bank accounts are required.");
      if(String(body.fromAccountId)===String(body.toAccountId)) throw httpError(400,"Source and destination bank accounts must be different.");
    }

    const transactionDate=body.transactionDate?new Date(body.transactionDate):new Date();
    const description=body.description||`${body.type.replace(/_/g," ")} transfer`;

    const item=await CashBankTransaction.create({
      type:body.type,
      amount,
      transactionDate,
      description,
      fromAccountId:body.type==="cash_to_bank"?undefined:body.fromAccountId,
      toAccountId:body.type==="bank_to_cash"?undefined:body.toAccountId,
      createdBy:req.auth?._id,
    });

    if(body.type!=="bank_to_bank"){
      const destCode=body.type==="cash_to_bank"?"1201":"1001";
      const sourceCode=body.type==="cash_to_bank"?"1001":"1201";
      await postJournal({req,voucherType:"contra",lines:[{accountCode:destCode,debit:amount},{accountCode:sourceCode,credit:amount}],narration:description,referenceType:"CashBankTransaction",referenceId:item._id});
    }

    await AuditLog.create({userId:req.auth?._id,action:"create",entityType:"CashBankTransaction",entityId:item._id,changes:item.toObject(),ipAddress:req.ip});
    res.status(201).json({item});
  }catch(error){next(error);}
}
