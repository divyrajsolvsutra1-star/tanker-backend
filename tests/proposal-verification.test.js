import { test, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import http from "node:http";
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import { User } from "../src/models/user.model.js";
import { RolePermission } from "../src/models/role-permission.model.js";
import { hashPassword } from "../src/utils/security.js";

let server;
let baseUrl;
let adminCookie;
let managerCookie;
let operatorCookie;
let accountantCookie;

const ORIGIN_HEADER = { Origin: env.corsOrigin || "http://localhost:3000" };

async function api(path, { method = "GET", body, cookie } = {}) {
  const headers = { ...ORIGIN_HEADER, "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, data: json, raw: text };
}

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  // Ensure default roles exist
  const roles = [
    {
      role: "manager",
      permissions: {
        dashboard: ["read"],
        customers: ["read", "create", "update"],
        vehicles: ["read", "create", "update"],
        washTypesRates: ["read", "update"],
        washEntries: ["read", "create", "update", "approve"],
        washStatuses: ["read", "update"],
        receipts: ["read"],
        employees: ["read"],
        reports: ["read"],
      }
    },
    {
      role: "entry_operator",
      permissions: {
        customers: ["read", "create"],
        vehicles: ["read", "create"],
        washTypesRates: ["read"],
        washEntries: ["read", "create"],
        washStatuses: ["read", "update"],
        receipts: ["read"],
        employees: ["read"],
      }
    },
    {
      role: "accountant",
      permissions: {
        dashboard: ["read"],
        customerLedger: ["read", "create"],
        cashBank: ["read", "create"],
        expenses: ["read", "create"],
        employees: ["read", "create"],
        accounting: ["read"],
        reports: ["read", "export"],
      }
    }
  ];
  for (const r of roles) {
    await RolePermission.updateOne({ role: r.role }, { $set: r }, { upsert: true });
  }

  // Ensure demo users exist
  const testUsers = [
    { email: "test-admin@tanker.local", password: "Password@123", role: "owner_admin", displayName: "Test Admin" },
    { email: "test-manager@tanker.local", password: "Password@123", role: "manager", displayName: "Test Manager" },
    { email: "test-operator@tanker.local", password: "Password@123", role: "entry_operator", displayName: "Test Operator" },
    { email: "test-accountant@tanker.local", password: "Password@123", role: "accountant", displayName: "Test Accountant" },
  ];

  for (const u of testUsers) {
    const passwordHash = await hashPassword(u.password);
    await User.updateOne(
      { email: u.email },
      { $set: { email: u.email, displayName: u.displayName, role: u.role, passwordHash, status: "active", mfaEnabled: false } },
      { upsert: true }
    );
  }

  // Login users to get session cookies
  async function login(email, password) {
    const res = await api("/auth/login", { method: "POST", body: { email, password } });
    assert.equal(res.status, 200, `Login failed for ${email}: ${res.raw}`);
    const cookie = res.headers.get("set-cookie");
    return cookie ? cookie.split(";")[0] : null;
  }

  adminCookie = await login("test-admin@tanker.local", "Password@123");
  managerCookie = await login("test-manager@tanker.local", "Password@123");
  operatorCookie = await login("test-operator@tanker.local", "Password@123");
  accountantCookie = await login("test-accountant@tanker.local", "Password@123");
});

after(async () => {
  if (server) await new Promise((res) => server.close(res));
  await mongoose.disconnect();
});

test("Tanker Wash Management System - Full Proposal Verification", async (t) => {
  let companyCustomer;
  let individualCustomer;
  let tankerVehicle1;
  let tankerVehicle2;
  let washTypeNormal;
  let washTypeDetergent;
  let washTypeUria;
  let employeeWasher;
  let bankAccountHdfc;
  let washEntryImmediate;
  let washEntryCredit;
  let resTB;

  await t.test("4.1 Customer & Company Management: Company and Individual", async () => {
    // 1. Company customer
    const resCo = await api("/customers", {
      method: "POST",
      cookie: adminCookie,
      body: {
        customerType: "company",
        name: "Test Gujarat Roadways Ltd",
        ownerName: "Harish Patel",
        contactPerson: "Dharmesh Shah",
        mobileNumber: "+919825000001",
        gstNumber: "24AAACG1234F1Z5",
        address: "GIDC Industrial Estate, Vadodara",
        openingBalance: 1500,
        creditLimit: 50000,
        creditPeriod: 15,
        paymentTerms: "15_days",
        status: "active"
      }
    });
    assert.equal(resCo.status, 201, `Create company customer failed: ${resCo.raw}`);
    companyCustomer = resCo.data.item;
    assert.equal(companyCustomer.customerType, "company");
    assert.equal(companyCustomer.creditLimit, 50000);
    assert.equal(companyCustomer.paymentTerms, "15_days");

    // 2. Individual customer
    const resInd = await api("/customers", {
      method: "POST",
      cookie: adminCookie,
      body: {
        customerType: "individual",
        name: "Ramesh Tanker Owner",
        mobileNumber: "+919825000002",
        openingBalance: 0,
        creditLimit: 5000,
        creditPeriod: 0,
        paymentTerms: "immediate",
        status: "active"
      }
    });
    assert.equal(resInd.status, 201, `Create individual customer failed: ${resInd.raw}`);
    individualCustomer = resInd.data.item;
    assert.equal(individualCustomer.customerType, "individual");
  });

  await t.test("4.2 Vehicle Management: Register & Link Vehicles", async () => {
    // Vehicle 1 for Company
    const resV1 = await api("/vehicles", {
      method: "POST",
      cookie: adminCookie,
      body: {
        vehicleNumber: "GJ06TX" + Math.floor(1000 + Math.random() * 9000),
        customerId: companyCustomer._id,
        driverName: "Sanjay Driver",
        driverMobileNumber: "+919909000001",
        status: "active"
      }
    });
    assert.equal(resV1.status, 201, `Create vehicle 1 failed: ${resV1.raw}`);
    tankerVehicle1 = resV1.data.item;
    assert.equal(tankerVehicle1.customerId, companyCustomer._id);

    // Vehicle 2 for Company (Multiple vehicles linked to same company)
    const resV2 = await api("/vehicles", {
      method: "POST",
      cookie: adminCookie,
      body: {
        vehicleNumber: "GJ06TY" + Math.floor(1000 + Math.random() * 9000),
        customerId: companyCustomer._id,
        driverName: "Vikram Driver",
        driverMobileNumber: "+919909000002",
        status: "active"
      }
    });
    assert.equal(resV2.status, 201, `Create vehicle 2 failed: ${resV2.raw}`);
    tankerVehicle2 = resV2.data.item;

    // Search vehicles
    const resList = await api(`/vehicles?search=${tankerVehicle1.vehicleNumber}`, { cookie: adminCookie });
    assert.equal(resList.status, 200);
    assert.ok(resList.data.items.some(v => v.vehicleNumber === tankerVehicle1.vehicleNumber));
  });

  await t.test("4.3 Wash Type & Company-wise Rate Management: 3 Services & Rates", async () => {
    // Proposal: 3 wash services: Normal Wash, Detergent Wash, Uria Wash
    const resWT1 = await api("/wash-types", {
      method: "POST",
      cookie: adminCookie,
      body: {
        name: "Normal Wash - " + Date.now(),
        description: "Standard exterior tanker body wash",
        active: true,
        rates: [
          { customerId: companyCustomer._id, amount: 350 },
          { customerId: individualCustomer._id, amount: 300 }
        ]
      }
    });
    assert.equal(resWT1.status, 201, `Create Normal Wash failed: ${resWT1.raw}`);
    washTypeNormal = resWT1.data.item;

    const resWT2 = await api("/wash-types", {
      method: "POST",
      cookie: adminCookie,
      body: {
        name: "Detergent Wash - " + Date.now(),
        description: "Chemical detergent wash for greasy residue",
        active: true,
        rates: [
          { customerId: companyCustomer._id, amount: 550 },
          { customerId: individualCustomer._id, amount: 500 }
        ]
      }
    });
    assert.equal(resWT2.status, 201);
    washTypeDetergent = resWT2.data.item;

    const resWT3 = await api("/wash-types", {
      method: "POST",
      cookie: adminCookie,
      body: {
        name: "Uria Wash - " + Date.now(),
        description: "Specialized urea wash for chemical tankers",
        active: true,
        rates: [
          { customerId: companyCustomer._id, amount: 750 },
          { customerId: individualCustomer._id, amount: 700 }
        ]
      }
    });
    assert.equal(resWT3.status, 201);
    washTypeUria = resWT3.data.item;
  });

  await t.test("4.10 Employee Registration: Washers / Workers", async () => {
    const resEmp = await api("/employees", {
      method: "POST",
      cookie: adminCookie,
      body: {
        name: "Kalu Ram Washer",
        mobileNumber: "+919712000001",
        address: "Washing Bay Staff Quarters",
        designation: "Head Washer",
        monthlySalary: 15000,
        status: "active"
      }
    });
    assert.equal(resEmp.status, 201, `Create employee failed: ${resEmp.raw}`);
    employeeWasher = resEmp.data.item;
    assert.equal(employeeWasher.monthlySalary, 15000);
  });

  await t.test("4.8 Bank Account Setup: Multiple Accounts", async () => {
    const resBank = await api("/bank-accounts", {
      method: "POST",
      cookie: adminCookie,
      body: {
        bankName: "HDFC Bank",
        accountName: "Tanker Wash Operations A/C",
        accountNumber: "50200012345678",
        ifsc: "HDFC0001234",
        openingBalance: 25000,
        active: true
      }
    });
    assert.equal(resBank.status, 201, `Create bank account failed: ${resBank.raw}`);
    bankAccountHdfc = resBank.data.item;
    assert.equal(bankAccountHdfc.openingBalance, 25000);
  });

  await t.test("4.4 & 4.5 Tanker Wash Entry (Immediate Payment) & Receipt Data", async () => {
    // Normal Wash with immediate Cash payment
    const resEntry = await api("/wash-entries", {
      method: "POST",
      cookie: operatorCookie,
      body: {
        customerId: companyCustomer._id,
        vehicleId: tankerVehicle1._id,
        washTypeId: washTypeNormal._id,
        employeeIds: [employeeWasher._id],
        driverName: "Sanjay Driver",
        driverMobileNumber: "+919909000001",
        savedRate: 350,
        paymentType: "immediate",
        paymentMethod: "cash"
      }
    });
    assert.equal(resEntry.status, 201, `Wash entry create failed: ${resEntry.raw}`);
    washEntryImmediate = resEntry.data.item;
    assert.ok(washEntryImmediate.entryNumber.startsWith("TW-"));
    assert.equal(washEntryImmediate.savedRate, 350);
    assert.equal(washEntryImmediate.paymentType, "immediate");
    assert.equal(washEntryImmediate.paymentMethod, "cash");
    assert.equal(washEntryImmediate.status, "booked");

    // Check receipt fetch endpoint (4.5)
    const resReceipt = await api(`/wash-entries/${washEntryImmediate._id}`, { cookie: operatorCookie });
    assert.equal(resReceipt.status, 200);
    const receipt = resReceipt.data.item;
    assert.equal(receipt.entryNumber, washEntryImmediate.entryNumber);
    assert.equal(receipt.savedRate, 350);
    assert.ok(receipt.customerId);
    assert.ok(receipt.vehicleId);
  });

  await t.test("4.4 Wash Entry (Credit / Outstanding Payment) with Rate Override", async () => {
    // Detergent Wash on credit with authorized rate modification
    const resEntry = await api("/wash-entries", {
      method: "POST",
      cookie: adminCookie,
      body: {
        customerId: companyCustomer._id,
        vehicleId: tankerVehicle2._id,
        washTypeId: washTypeDetergent._id,
        employeeIds: [employeeWasher._id],
        driverName: "Vikram Driver",
        driverMobileNumber: "+919909000002",
        savedRate: 600, // modified from configured 550
        rateModified: true,
        rateModificationReason: "Heavy grease extra charge",
        paymentType: "credit",
        creditApproved: true
      }
    });
    assert.equal(resEntry.status, 201, `Credit wash entry failed: ${resEntry.raw}`);
    washEntryCredit = resEntry.data.item;
    assert.equal(washEntryCredit.paymentType, "credit");
    assert.equal(washEntryCredit.savedRate, 600);
    assert.equal(washEntryCredit.rateModified, true);
  });

  await t.test("4.6 Wash Status Lifecycle Management", async () => {
    // Status flow: booked -> washing -> completed -> delivered
    const steps = ["washing", "completed", "delivered"];
    for (const nextStatus of steps) {
      const resUpdate = await api(`/wash-entries/${washEntryImmediate._id}/status`, {
        method: "PATCH",
        cookie: operatorCookie,
        body: { status: nextStatus, note: `Moved to ${nextStatus}` }
      });
      assert.equal(resUpdate.status, 200, `Status update to ${nextStatus} failed: ${resUpdate.raw}`);
      assert.equal(resUpdate.data.item.status, nextStatus);
    }
  });

  await t.test("4.7 Customer Ledger & Payment Allocation", async () => {
    // Check initial ledger statement
    const resLedgerBefore = await api(`/ledger/${companyCustomer._id}`, { cookie: accountantCookie });
    assert.equal(resLedgerBefore.status, 200);
    // Company had opening 1500, + immediate wash 350, + credit wash 600
    // Ledger balance tracks opening + all wash charges - payments
    assert.ok(resLedgerBefore.data.outstanding > 0);

    // Record customer payment of ₹1000 with allocation ₹600 against the credit wash entry
    const resPay = await api("/ledger/payments", {
      method: "POST",
      cookie: accountantCookie,
      body: {
        customerId: companyCustomer._id,
        amount: 1000,
        paymentMethod: "bank",
        bankAccountId: bankAccountHdfc._id,
        allocations: [{ washEntryId: washEntryCredit._id, amount: 600 }],
        idempotencyKey: "test-pay-" + Date.now()
      }
    });
    assert.equal(resPay.status, 201, `Record payment failed: ${resPay.raw}`);
    const payment = resPay.data.item;
    assert.equal(payment.amount, 1000);
    assert.equal(payment.allocations[0].amount, 600);
    assert.equal(payment.unallocatedAmount, 400); // 1000 - 600 = 400 advance

    // Check updated ledger
    const resLedgerAfter = await api(`/ledger/${companyCustomer._id}`, { cookie: accountantCookie });
    assert.equal(resLedgerAfter.status, 200);
    assert.equal(resLedgerAfter.data.advance, 400);
  });

  await t.test("4.8 Cash & Bank Management: Transactions & Transfers", async () => {
    // Record Bank-to-Cash transfer of ₹5000
    const resContra = await api("/cash-bank/transactions", {
      method: "POST",
      cookie: accountantCookie,
      body: {
        type: "bank_to_cash",
        amount: 5000,
        fromAccountId: bankAccountHdfc._id,
        description: "ATM Cash withdrawal for operational drawer"
      }
    });
    assert.equal(resContra.status, 201, `Cash bank transaction failed: ${resContra.raw}`);

    // List transactions
    const resList = await api("/cash-bank/transactions", { cookie: accountantCookie });
    assert.equal(resList.status, 200);
    assert.ok(resList.data.items.length > 0);
  });

  await t.test("4.9 Expense Management: Record Operating Expenses", async () => {
    const resExp = await api("/expenses", {
      method: "POST",
      cookie: accountantCookie,
      body: {
        expenseDate: new Date(),
        category: "Electricity",
        description: "High-pressure washer pump electricity bill",
        amount: 3200,
        paymentMode: "bank",
        accountId: bankAccountHdfc._id
      }
    });
    assert.equal(resExp.status, 201, `Expense create failed: ${resExp.raw}`);
    assert.equal(resExp.data.item.category, "Electricity");
    assert.equal(resExp.data.item.amount, 3200);
  });

  await t.test("4.10 Employee Salary & Advance Management", async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    // 1. Give salary advance of ₹2000
    const resAdv = await api("/salary/transactions", {
      method: "POST",
      cookie: accountantCookie,
      body: {
        employeeId: employeeWasher._id,
        month: currentMonth,
        type: "advance",
        amount: 2000,
        paymentMethod: "cash"
      }
    });
    assert.equal(resAdv.status, 201, `Salary advance failed: ${resAdv.raw}`);

    // 2. Pay monthly salary of ₹10000
    const resSal = await api("/salary/transactions", {
      method: "POST",
      cookie: accountantCookie,
      body: {
        employeeId: employeeWasher._id,
        month: currentMonth,
        type: "salary",
        amount: 10000,
        paymentMethod: "bank",
        bankAccountId: bankAccountHdfc._id
      }
    });
    assert.equal(resSal.status, 201, `Salary payment failed: ${resSal.raw}`);

    // 3. Verify monthly salary register calculations
    const resReg = await api(`/salary/register?month=${currentMonth}`, { cookie: accountantCookie });
    assert.equal(resReg.status, 200);
    const empRow = resReg.data.rows.find(r => String(r.employee._id) === String(employeeWasher._id));
    assert.ok(empRow, "Employee row found in salary register");
    assert.equal(empRow.monthlySalary, 15000);
    assert.equal(empRow.advances, 2000);
    assert.equal(empRow.paid, 10000);
    assert.equal(empRow.remaining, 5000); // 15000 - 10000 = 5000
  });

  await t.test("4.11 Double-Entry Accounting & Financial Statements", async () => {
    // 1. Chart of Accounts & posted journals
    const resAcc = await api("/accounting", { cookie: accountantCookie });
    assert.equal(resAcc.status, 200);
    assert.ok(resAcc.data.accounts.length > 0);
    assert.ok(resAcc.data.journals.length > 0);

    // 2. Trial Balance
    resTB = await api("/reports/trial-balance", { cookie: accountantCookie });
    assert.equal(resTB.status, 200);
    assert.equal(resTB.data.balanced, true, "Trial balance debits equal credits");

    // 3. Profit & Loss
    const resPL = await api("/reports/profit-loss", { cookie: accountantCookie });
    assert.equal(resPL.status, 200);
    assert.ok(typeof resPL.data.netProfit === "number");

    // 4. Balance Sheet
    const resBS = await api("/reports/balance-sheet", { cookie: accountantCookie });
    assert.equal(resBS.status, 200);
    assert.equal(resBS.data.balanced, true, "Balance sheet assets equal liabilities + equity");

    // 5. Day Book
    const resDB = await api("/reports/day-book", { cookie: accountantCookie });
    assert.equal(resDB.status, 200);
    assert.ok(Array.isArray(resDB.data.lines));

    // 6. Cash Book & Bank Book
    const resCB = await api("/reports/cash-book", { cookie: accountantCookie });
    assert.equal(resCB.status, 200);
    const resBB = await api("/reports/bank-book", { cookie: accountantCookie });
    assert.equal(resBB.status, 200);
  });

  await t.test("4.12 Dashboard & Business Overview", async () => {
    const resDash = await api("/dashboard", { cookie: adminCookie });
    assert.equal(resDash.status, 200);
    const d = resDash.data;
    assert.ok(d.todayWashEntries >= 2);
    assert.ok(d.todayVehicles >= 2);
    assert.ok(d.statuses.delivered >= 1 || d.statuses.booked >= 1);
    assert.ok(typeof d.todayCollections === "number");
    assert.ok(typeof d.totalCustomerOutstanding === "number");
    assert.ok(Array.isArray(d.bankBalances));
  });

  await t.test("4.13 Reports & Multi-format Export", async () => {
    // Wash Report
    const resWRep = await api("/reports/wash", { cookie: adminCookie });
    assert.equal(resWRep.status, 200);
    assert.ok(resWRep.data.items.length >= 2);

    // Wash Type-wise Report
    const resWTWise = await api("/reports/wash-type-wise", { cookie: adminCookie });
    assert.equal(resWTWise.status, 200);
    assert.ok(resWTWise.data.byWashType.length > 0);

    // Customer-wise Report
    const resCWise = await api("/reports/customer-wise", { cookie: adminCookie });
    assert.equal(resCWise.status, 200);

    // Export formats list
    const resFmt = await api("/export-formats", { cookie: adminCookie });
    assert.equal(resFmt.status, 200);
    assert.ok(resFmt.data.formats.some(f => f.format === "csv"));
    assert.ok(resFmt.data.formats.some(f => f.format === "html"));
    assert.ok(resFmt.data.formats.some(f => f.format === "print"));

    // Export Trial Balance to CSV
    const resExpCsv = await api("/export", {
      method: "POST",
      cookie: adminCookie,
      body: { reportName: "trial-balance", format: "csv", data: resTB.data.lines, columns: ["code", "name", "debit", "credit"] }
    });
    assert.equal(resExpCsv.status, 200);
    assert.ok(resExpCsv.raw.includes("code") || resExpCsv.raw.includes("debit"));

    // Export Trial Balance to Print
    const resExpPrint = await api("/export", {
      method: "POST",
      cookie: adminCookie,
      body: { reportName: "trial-balance", format: "print", data: resTB.data }
    });
    assert.equal(resExpPrint.status, 200);
    assert.ok(resExpPrint.raw.includes("<html"));
  });

  await t.test("4.14 User Management & Role Permissions Enforcement", async () => {
    // Entry Operator tries to access Accounting module -> Should be forbidden (403)
    const resForbidden = await api("/accounting", { cookie: operatorCookie });
    assert.equal(resForbidden.status, 403, "Entry operator cannot access accounting");

    // Accountant tries to create wash entries -> Should be forbidden (403)
    const resForbiddenWash = await api("/wash-entries", {
      method: "POST",
      cookie: accountantCookie,
      body: { customerId: companyCustomer._id }
    });
    assert.equal(resForbiddenWash.status, 403, "Accountant cannot create wash entries");

    // Manager can access dashboard and wash operations
    const resMgrDash = await api("/dashboard", { cookie: managerCookie });
    assert.equal(resMgrDash.status, 200, "Manager can access dashboard");
  });
});
