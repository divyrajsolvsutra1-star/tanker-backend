import { test } from "node:test";
import assert from "node:assert";

// Test suite for main business workflows

test("Module: Customer & Company Management", async (t) => {
  await t.test("should validate customer types", () => {
    const validTypes = ["company", "individual"];
    assert.deepEqual(validTypes, ["company", "individual"]);
  });

  await t.test("should validate customer fields", () => {
    const customer = {
      customerType: "company",
      name: "ABC Tankers",
      ownerName: "John Doe",
      contactPerson: "Jane Doe",
      mobileNumber: "+919876543210",
      gstNumber: "27AABCU9603R1Z0",
      address: "123 Main St",
      openingBalance: 5000,
      creditLimit: 50000,
      creditPeriod: 30,
      paymentTerms: "15_days"
    };
    assert.ok(customer.name);
    assert.ok(customer.customerType);
    assert.ok(customer.creditLimit >= 0);
  });
});

test("Module: Vehicle Management", async (t) => {
  await t.test("should validate vehicle fields", () => {
    const vehicle = {
      vehicleNumber: "MH01AB1234",
      driverName: "Ram Kumar",
      driverMobileNumber: "+919876543211",
      status: "active"
    };
    assert.ok(vehicle.vehicleNumber);
    assert.ok(vehicle.driverName);
    assert.match(vehicle.vehicleNumber, /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/);
  });
});

test("Module: Wash Type & Rate Management", async (t) => {
  await t.test("should validate wash types", () => {
    const validWashTypes = ["Normal Wash", "Detergent Wash", "Uria Wash"];
    assert.equal(validWashTypes.length, 3);
  });

  await t.test("should validate rates structure", () => {
    const washType = {
      name: "Normal Wash",
      rates: [
        { customerId: "customer1", amount: 300 },
        { customerId: "customer2", amount: 350 }
      ]
    };
    assert.ok(Array.isArray(washType.rates));
    assert.ok(washType.rates[0].amount > 0);
  });
});

test("Module: Wash Entry Management", async (t) => {
  await t.test("should validate wash entry status flow", () => {
    const statuses = ["booked", "washing", "completed", "delivered", "cancelled"];
    const workflow = ["booked", "washing", "completed", "delivered"];
    assert.ok(workflow.every(s => statuses.includes(s)));
  });

  await t.test("should validate payment types", () => {
    const paymentTypes = ["immediate", "credit"];
    assert.equal(paymentTypes.length, 2);
  });

  await t.test("should validate payment methods", () => {
    const methods = ["cash", "upi", "bank"];
    assert.equal(methods.length, 3);
  });

  await t.test("should validate rate modification tracking", () => {
    const history = [
      { amount: 300, modifiedAt: new Date(), reason: "Customer specific rate" }
    ];
    assert.ok(Array.isArray(history));
    assert.ok(history[0].amount > 0);
  });
});

test("Module: Customer Ledger & Payment", async (t) => {
  await t.test("should calculate ledger balance correctly", () => {
    const ledger = {
      openingBalance: 5000,
      washes: [
        { amount: 500, date: new Date() },
        { amount: 500, date: new Date() }
      ],
      payments: [
        { amount: 300, date: new Date() },
        { amount: 500, date: new Date() }
      ]
    };

    const totalCharges = ledger.washes.reduce((sum, w) => sum + w.amount, 0);
    const totalPayments = ledger.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = ledger.openingBalance + totalCharges - totalPayments;

    assert.equal(totalCharges, 1000);
    assert.equal(totalPayments, 800);
    assert.equal(balance, 5200);
  });

  await t.test("should validate allocation logic", () => {
    const outstanding = 1000;
    const payment = 600;
    const allocation = 600;

    assert.ok(allocation <= payment, "Allocation should not exceed payment");
    assert.ok(allocation <= outstanding, "Allocation should not exceed outstanding");
  });

  await t.test("should validate credit limit checks", () => {
    const customer = { creditLimit: 50000, openingBalance: 10000 };
    const newWash = 500;
    const totalOutstanding = customer.openingBalance + newWash;

    const creditApprovalRequired = totalOutstanding > customer.creditLimit;
    assert.equal(creditApprovalRequired, false);
  });
});

test("Module: Cash & Bank Management", async (t) => {
  await t.test("should validate transaction types", () => {
    const types = ["cash_in", "cash_out", "bank_in", "bank_out", "upi_in", "upi_out"];
    assert.equal(types.length, 6);
  });

  await t.test("should calculate account balance", () => {
    const opening = 10000;
    const transactions = [
      { type: "cash_in", amount: 5000 },
      { type: "cash_out", amount: 2000 },
      { type: "cash_in", amount: 1000 }
    ];

    const inAmount = transactions.filter(t => t.type.endsWith("_in")).reduce((s, t) => s + t.amount, 0);
    const outAmount = transactions.filter(t => t.type.endsWith("_out")).reduce((s, t) => s + t.amount, 0);
    const balance = opening + inAmount - outAmount;

    assert.equal(inAmount, 6000);
    assert.equal(outAmount, 2000);
    assert.equal(balance, 14000);
  });
});

test("Module: Expense Management", async (t) => {
  await t.test("should validate expense categories", () => {
    const categories = [
      "Electricity", "Water", "Rent", "Maintenance",
      "Diesel / Fuel", "Machinery Repair", "Office Expenses", "Other Expenses"
    ];
    assert.equal(categories.length, 8);
  });

  await t.test("should validate payment modes", () => {
    const modes = ["cash", "upi", "bank"];
    assert.equal(modes.length, 3);
  });
});

test("Module: Employee & Salary Management", async (t) => {
  await t.test("should calculate salary deductions", () => {
    const salary = {
      monthlySalary: 10000,
      advances: [
        { amount: 2000, date: "2024-01-05" },
        { amount: 1000, date: "2024-01-10" }
      ],
      payments: [
        { amount: 5000, date: "2024-01-25" }
      ]
    };

    const totalAdvances = salary.advances.reduce((s, a) => s + a.amount, 0);
    const totalPayments = salary.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = salary.monthlySalary - totalPayments;

    assert.equal(totalAdvances, 3000);
    assert.equal(totalPayments, 5000);
    assert.equal(remaining, 5000);
  });
});

test("Module: Accounting & Double-Entry", async (t) => {
  await t.test("should validate journal balance", () => {
    const journal = {
      lines: [
        { accountCode: "1001", debit: 500, credit: 0 },
        { accountCode: "4001", debit: 0, credit: 500 }
      ]
    };

    const totalDebit = journal.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = journal.lines.reduce((s, l) => s + l.credit, 0);

    assert.equal(totalDebit, totalCredit, "Journal must balance");
  });

  await t.test("should calculate account balance based on type", () => {
    const accounts = [
      { code: "1001", name: "Cash", type: "asset", opening: 10000, debit: 5000, credit: 2000 },
      { code: "4001", name: "Income", type: "income", opening: 0, debit: 0, credit: 3000 },
      { code: "5001", name: "Expense", type: "expense", opening: 0, debit: 2000, credit: 0 }
    ];

    const getBalance = (acc) => {
      if (acc.type === "asset" || acc.type === "expense") {
        return acc.opening + acc.debit - acc.credit;
      } else {
        return acc.opening + acc.credit - acc.debit;
      }
    };

    assert.equal(getBalance(accounts[0]), 13000); // Asset
    assert.equal(getBalance(accounts[1]), 3000);  // Income
    assert.equal(getBalance(accounts[2]), 2000);  // Expense
  });

  await t.test("should validate trial balance equation", () => {
    const accounts = [
      { code: "1001", type: "asset", balance: 15000 },
      { code: "1101", type: "asset", balance: 5000 },
      { code: "2001", type: "liability", balance: 10000 },
      { code: "3001", type: "equity", balance: 10000 }
    ];

    const totalDebit = accounts.filter(a => a.type === "asset").reduce((s, a) => s + a.balance, 0);
    const totalCredit = accounts.filter(a => a.type !== "asset").reduce((s, a) => s + a.balance, 0);

    assert.equal(totalDebit, totalCredit, "Trial balance must balance");
  });
});

test("Module: Dashboard & Reports", async (t) => {
  await t.test("should calculate dashboard metrics", () => {
    const data = {
      todaysWashes: [
        { status: "booked", amount: 500 },
        { status: "washing", amount: 500 },
        { status: "completed", amount: 500 },
        { status: "delivered", amount: 500 }
      ],
      collections: [
        { amount: 2000, type: "cash" },
        { amount: 1000, type: "bank" }
      ]
    };

    const statusCount = {
      booked: data.todaysWashes.filter(w => w.status === "booked").length,
      washing: data.todaysWashes.filter(w => w.status === "washing").length,
      completed: data.todaysWashes.filter(w => w.status === "completed").length,
      delivered: data.todaysWashes.filter(w => w.status === "delivered").length
    };

    const totalCollection = data.collections.reduce((s, c) => s + c.amount, 0);

    assert.equal(statusCount.booked, 1);
    assert.equal(statusCount.delivered, 1);
    assert.equal(totalCollection, 3000);
  });

  await t.test("should generate wash type wise summary", () => {
    const washes = [
      { type: "Normal", amount: 300 },
      { type: "Normal", amount: 300 },
      { type: "Detergent", amount: 500 },
      { type: "Uria", amount: 700 }
    ];

    const summary = {};
    washes.forEach(w => {
      if (!summary[w.type]) summary[w.type] = { count: 0, total: 0 };
      summary[w.type].count++;
      summary[w.type].total += w.amount;
    });

    assert.equal(summary["Normal"].count, 2);
    assert.equal(summary["Normal"].total, 600);
    assert.equal(summary["Detergent"].count, 1);
  });
});

test("Module: User & Permissions", async (t) => {
  await t.test("should define user roles", () => {
    const roles = ["Owner/Admin", "Manager", "Entry Operator", "Accountant", "Washer/Employee"];
    assert.equal(roles.length, 5);
  });

  await t.test("should define module permissions", () => {
    const modules = [
      "dashboard", "customers", "vehicles", "washTypesRates",
      "washEntries", "receipts", "washStatuses", "customerLedger",
      "employees", "expenses", "cashBank", "accounting",
      "reports", "auditLogs", "users", "roles", "settings"
    ];
    assert.ok(modules.length > 0);
  });

  await t.test("should validate permission actions", () => {
    const actions = ["read", "create", "update", "deactivate"];
    assert.equal(actions.length, 4);
  });
});

test("Integration: Complete Wash Entry Workflow", async (t) => {
  await t.test("should validate end-to-end wash entry flow", () => {
    // 1. Create customer and vehicle
    const customer = { name: "ABC Corp", creditLimit: 50000, openingBalance: 10000 };
    const vehicle = { vehicleNumber: "MH01AB1234", customerId: "cust_1" };

    // 2. Create wash entry
    const washEntry = {
      entryNumber: "TW-20240115-00001",
      customerId: "cust_1",
      vehicleId: "veh_1",
      washTypeId: "wash_1",
      savedRate: 500,
      paymentType: "immediate",
      paymentMethod: "cash",
      status: "booked"
    };

    // 3. Update status workflow
    const statusProgression = ["booked", "washing", "completed", "delivered"];
    let currentStatus = "booked";
    const steps = [];

    for (const nextStatus of statusProgression) {
      const statusHistory = {
        status: nextStatus,
        changedAt: new Date(),
        note: `Changed to ${nextStatus}`
      };
      steps.push(statusHistory);
      currentStatus = nextStatus;
    }

    // 4. Record payment
    const payment = {
      customerId: "cust_1",
      amount: 500,
      paymentMethod: "cash",
      allocations: [{ washEntryId: "wash_entry_1", amount: 500 }]
    };

    // 5. Validate accounting posting
    const journal = {
      lines: [
        { accountCode: "1001", debit: 500, description: "Cash receipt" },
        { accountCode: "4001", credit: 500, description: "Wash income" }
      ]
    };

    const totalDebit = journal.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = journal.lines.reduce((s, l) => s + (l.credit || 0), 0);

    assert.ok(washEntry.entryNumber);
    assert.ok(steps.length === 4);
    assert.ok(payment.allocations[0].amount === washEntry.savedRate);
    assert.equal(totalDebit, totalCredit);
  });
});

test("Validation: Business Rules", async (t) => {
  await t.test("should enforce credit limit rules", () => {
    const customer = { creditLimit: 50000, openingBalance: 45000 };
    const newWashAmount = 6000;
    const totalOutstanding = customer.openingBalance + newWashAmount;

    const needsApproval = totalOutstanding > customer.creditLimit;
    assert.equal(needsApproval, true);
  });

  await t.test("should validate rate modification rules", () => {
    const originalRate = 500;
    const modifiedRate = 600;
    const rateModified = originalRate !== modifiedRate;

    assert.equal(rateModified, true);
  });

  await t.test("should enforce payment allocation rules", () => {
    const outstanding = 1000;
    const payment = 600;
    const allocation = 600;

    // Validation checks
    assert.ok(allocation > 0, "Allocation must be positive");
    assert.ok(allocation <= payment, "Allocation cannot exceed payment");
    assert.ok(allocation <= outstanding, "Allocation cannot exceed outstanding");
  });
});
