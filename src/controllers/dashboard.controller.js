import { Customer } from "../models/customer.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { WashEntry } from "../models/wash-entry.model.js";
import { Expense } from "../models/expense.model.js";
import { LedgerPayment } from "../models/ledger-payment.model.js";
import { CashBankTransaction } from "../models/cash-bank-transaction.model.js";
import { BankAccount } from "../models/bank-account.model.js";
import { WashType } from "../models/wash-type.model.js";

export async function getDashboard(_req, res, next) {
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const [
      todayEntries, todayVehicles, statusCounts, customers, expenses, payments, bankAccounts,
      washTypes, washEntries
    ] = await Promise.all([
      WashEntry.countDocuments({ entryDate:{ $gte:start,$lte:end } }),
      WashEntry.distinct("vehicleId",{ entryDate:{ $gte:start,$lte:end } }),
      WashEntry.aggregate([{ $match:{ entryDate:{ $gte:start,$lte:end } } },{ $group:{ _id:"$status",count:{ $sum:1 } } }]),
      Customer.find({ status:"active" }).lean(),
      Expense.aggregate([{ $match:{ status:"active", expenseDate:{ $gte:monthStart,$lte:end } } },{ $group:{ _id:null,total:{ $sum:"$amount" } } }]),
      LedgerPayment.aggregate([{ $match:{ paymentDate:{ $gte:start,$lte:end } } },{ $group:{ _id:"$paymentMethod",total:{ $sum:"$amount" } } }]),
      BankAccount.find({active:true}).lean(),
      WashType.find({active:true}).lean(),
      WashEntry.find({ entryDate:{ $gte:start,$lte:end } }).populate("washTypeId").lean()
    ]);
    const statuses = Object.fromEntries(statusCounts.map((row) => [row._id,row.count]));
    const openingOutstanding = customers.reduce((sum,c) => sum + Number(c.openingBalance || 0), 0);
    const [washAmount, allocatedAmount, paymentAdvances] = await Promise.all([
      WashEntry.aggregate([
        { $match:{ customerId:{ $in:customers.map((customer)=>customer._id) }, paymentType:"credit", status:{ $ne:"cancelled" } } },
        { $group:{ _id:null,total:{ $sum:"$savedRate" } } }
      ]),
      LedgerPayment.aggregate([
        { $match:{ customerId:{ $in:customers.map((customer)=>customer._id) } } },
        { $unwind:{path:"$allocations",preserveNullAndEmptyArrays:true} },
        { $group:{ _id:null,total:{ $sum:{ $ifNull:["$allocations.amount",0] } } } }
      ]),
      LedgerPayment.aggregate([
        { $match:{ customerId:{ $in:customers.map((customer)=>customer._id) } } },
        { $group:{ _id:null,total:{ $sum:"$unallocatedAmount" } } }
      ])
    ]);
    const totalCustomerOutstanding = openingOutstanding
      + (washAmount[0]?.total || 0)
      - (allocatedAmount[0]?.total || 0)
      - (paymentAdvances[0]?.total || 0);
    const todayCollections = payments.reduce((sum,row) => sum + row.total,0);
    const washSummary = Object.fromEntries(washTypes.map((type) => [
      type.name,
      washEntries.filter((entry) => String(entry.washTypeId?._id) === String(type._id)).length
    ]));
    const bankBalances = await Promise.all(bankAccounts.map(async (account) => {
      const tx = await CashBankTransaction.aggregate([
        { $match:{ $or:[{toAccountId:account._id},{fromAccountId:account._id}] } },
        { $group:{ _id:null,
          in:{ $sum:{ $cond:[{$eq:["$toAccountId",account._id]},"$amount",0] } },
          out:{ $sum:{ $cond:[{$eq:["$fromAccountId",account._id]},"$amount",0] } }
        } }
      ]);
      const row = tx[0];
      return { id:account._id,name:account.accountName,bankName:account.bankName,balance:Number(account.openingBalance||0)+(row?.in||0)-(row?.out||0) };
    }));
    const cashTx = await CashBankTransaction.aggregate([
      { $match:{ transactionDate:{ $lte:end } } },
      { $group:{ _id:null,in:{ $sum:{ $cond:[{ $in:["$type",["cash_in","bank_to_cash","upi_in"]] },"$amount",0] } },out:{ $sum:{ $cond:[{ $in:["$type",["cash_out","cash_to_bank"]] },"$amount",0] } } } }
    ]);
    res.json({
      todayWashEntries:todayEntries,
      todayVehicles:todayVehicles.length,
      washTypeSummary:washSummary,
      statuses:{ booked:statuses.booked||0,washing:statuses.washing||0,completed:statuses.completed||0,delivered:statuses.delivered||0,cancelled:statuses.cancelled||0 },
      todayCollections,
      collectionByMethod:Object.fromEntries(payments.map((row)=>[row._id,row.total])),
      totalCustomerOutstanding,
      cashBalance:(cashTx[0]?.in||0)-(cashTx[0]?.out||0),
      bankBalances,
      monthlyExpenses:expenses[0]?.total||0
    });
  } catch (error) { next(error); }
}
