import mongoose from "mongoose";
import { Customer } from "../models/customer.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { WashType } from "../models/wash-type.model.js";
import { WashEntry } from "../models/wash-entry.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { Account, Journal } from "../models/accounting.model.js";
import { CashBankTransaction } from "../models/cash-bank-transaction.model.js";
import { ensureDefaultAccounts } from "../config/seed-defaults.js";

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

async function nextEntryNumber() {
  const count = await WashEntry.countDocuments();
  const date = new Date();
  const prefix = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  return `TW-${prefix}-${String(count + 1).padStart(5,"0")}`;
}

export async function listWashEntries(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const filter = {};
    for (const key of ["customerId","vehicleId","washTypeId","status","paymentType","paymentMethod"]) {
      if (req.query[key]) filter[key] = req.query[key];
    }
    if (req.query.search) {
      filter.$or = [
        { entryNumber: { $regex: req.query.search, $options: "i" } },
        { driverName: { $regex: req.query.search, $options: "i" } },
        { driverMobileNumber: { $regex: req.query.search, $options: "i" } }
      ];
    }
    if (req.query.from || req.query.to) {
      filter.entryDate = {};
      if (req.query.from) filter.entryDate.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) filter.entryDate.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
    if (req.query.employeeId) filter.employeeIds = req.query.employeeId;
    const [items,total] = await Promise.all([
      WashEntry.find(filter).populate("customerId vehicleId washTypeId employeeIds").sort({ entryDate:-1 }).skip((page-1)*limit).limit(limit).lean(),
      WashEntry.countDocuments(filter)
    ]);
    res.json({ items, pagination:{page,limit,total,pages:Math.ceil(total/limit)} });
  } catch (error) { next(error); }
}

export async function createWashEntry(req, res, next) {
  try {
    await ensureDefaultAccounts();
    const body = req.body ?? {};
    if (!body.customerId || !body.washTypeId) throw httpError(400, "Customer and wash type are required.");
    const [customer, vehicle, washType] = await Promise.all([
      Customer.findById(body.customerId),
      Vehicle.findById(body.vehicleId),
      WashType.findById(body.washTypeId)
    ]);
    if (!customer) throw httpError(404, "Customer not found.");
    if (!vehicle) throw httpError(404, "Vehicle not found.");
    if (!washType || !washType.active) throw httpError(404, "Active wash type not found.");
    if (String(vehicle.customerId) !== String(customer._id)) throw httpError(400, "Vehicle does not belong to this customer.");
    const rate = washType.rates?.find((rate) => String(rate.customerId) === String(customer._id));
    const savedRate = body.savedRate !== undefined ? Number(body.savedRate) : Number(rate?.amount ?? 0);
    if (!Number.isFinite(savedRate) || savedRate < 0) throw httpError(400, "A valid wash rate is required.");
    const paymentType = body.paymentType || "credit";
    let creditApprovalStatus = "not_required";
    if (paymentType === "credit") {
      const outstanding = customer.openingBalance || 0;
      if (outstanding + savedRate > customer.creditLimit && customer.creditLimit >= 0) creditApprovalStatus = "pending";
    }
    if (paymentType === "credit" && creditApprovalStatus === "pending" && body.creditApproved !== true) {
      throw httpError(403, "Credit limit approval is required from a Manager or Owner/Admin.");
    }
    if (paymentType === "immediate" && !["cash","upi","bank"].includes(body.paymentMethod)) throw httpError(400, "Immediate payment requires a payment method.");

    const entryNumber = await nextEntryNumber();
    const item = await WashEntry.create({
      entryNumber,
      customerId: customer._id,
      vehicleId: vehicle._id,
      washTypeId: washType._id,
      employeeIds: body.employeeIds || [],
      driverName: body.driverName ?? vehicle.driverName,
      driverMobileNumber: body.driverMobileNumber ?? vehicle.driverMobileNumber,
      savedRate,
      rateModified: body.rateModified === true,
      rateModificationHistory: body.rateModified ? [{ amount: savedRate, modifiedBy: req.auth?._id, reason: body.rateModificationReason || "Authorized modification" }] : [],
      paymentType,
      paymentMethod: paymentType === "immediate" ? body.paymentMethod : undefined,
      bankAccountId: body.bankAccountId,
      creditApprovalStatus,
      creditApprovedBy: body.creditApproved ? req.auth?._id : undefined,
      status: "booked",
      statusHistory: [{ status:"booked", changedBy:req.auth?._id, changedAt:new Date(), note:"Entry created" }],
      entryDate: body.entryDate ? new Date(body.entryDate) : new Date(),
      createdBy: req.auth?._id
    });

    await AuditLog.create({ userId:req.auth?._id, action:"create", entityType:"WashEntry", entityId:item._id, changes:item.toObject(), ipAddress:req.ip });

    const debitCode = paymentType === "immediate"
      ? (body.paymentMethod === "cash" ? "1001" : "1201")
      : "1101";
    const [debitAccount,creditAccount] = await Promise.all([
      Account.findOne({code:debitCode}),
      Account.findOne({code:"4001"})
    ]);
    if (!debitAccount || !creditAccount) throw httpError(500,"Required accounting accounts are unavailable.");
    const voucherCount = await Journal.countDocuments();
    await Journal.create({
      voucherNumber:`JV-${new Date().getFullYear()}-${String(voucherCount+1).padStart(6,"0")}`,
      voucherType:"journal",
      date:item.entryDate,
      lines:[
        {accountId:debitAccount._id,debit:savedRate,description:`Wash charge ${item.entryNumber}`},
        {accountId:creditAccount._id,credit:savedRate,description:`Wash income ${item.entryNumber}`}
      ],
      narration:`Tanker wash ${item.entryNumber}`,
      referenceType:"WashEntry",
      referenceId:item._id,
      status:"posted",
      createdBy:req.auth?._id
    });
    if (paymentType === "immediate") {
      await CashBankTransaction.create({
        type:body.paymentMethod==="upi"?"upi_in":body.paymentMethod==="cash"?"cash_in":"bank_in",
        amount:savedRate,
        transactionDate:item.entryDate,
        description:`Immediate wash receipt ${item.entryNumber}`,
        toAccountId:body.bankAccountId,
        referenceType:"WashEntry",
        referenceId:item._id,
        createdBy:req.auth?._id
      });
    }

    res.status(201).json({ item });
  } catch (error) { next(error); }
}

export async function updateWashStatus(req, res, next) {
  try {
    const allowed = ["booked","washing","completed","delivered","cancelled"];
    const status = req.body?.status;
    if (!allowed.includes(status)) throw httpError(400, "Invalid wash status.");
    const item = await WashEntry.findById(req.params.id);
    if (!item) throw httpError(404, "Wash entry not found.");
    item.status = status;
    item.statusHistory.push({ status, changedBy:req.auth?._id, changedAt:new Date(), note:req.body?.note });
    await item.save();
    await AuditLog.create({ userId:req.auth?._id, action:"status_update", entityType:"WashEntry", entityId:item._id, changes:{status,note:req.body?.note}, ipAddress:req.ip });
    res.json({ item });
  } catch (error) { next(error); }
}
