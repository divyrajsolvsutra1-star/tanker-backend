import { test } from "node:test";
import assert from "node:assert/strict";
import { planPaymentAdjustmentAfterWashEntryDelete } from "../src/controllers/wash.controller.js";

test("deleting an entry removes only its portion from a shared receipt", () => {
  const plan = planPaymentAdjustmentAfterWashEntryDelete(
    {
      receiptNumber: "RCT-1",
      amount: 500,
      unallocatedAmount: 50,
      allocations: [
        { washEntryId: "entry-1", amount: 200 },
        { washEntryId: "entry-2", amount: 250 },
      ],
    },
    "entry-1",
  );

  assert.equal(plan.remainingAmount, 300);
  assert.deepEqual(plan.remainingAllocations, [
    { washEntryId: "entry-2", amount: 250 },
  ]);
});

test("deleting the only entry allocation removes the full receipt amount", () => {
  const plan = planPaymentAdjustmentAfterWashEntryDelete(
    {
      receiptNumber: "RCT-2",
      amount: 250,
      unallocatedAmount: 0,
      allocations: [{ washEntryId: "entry-1", amount: 250 }],
    },
    "entry-1",
  );

  assert.equal(plan.remainingAmount, 0);
  assert.deepEqual(plan.remainingAllocations, []);
});

test("rejects deletion when a receipt has inconsistent allocations", () => {
  assert.throws(
    () =>
      planPaymentAdjustmentAfterWashEntryDelete(
        {
          receiptNumber: "RCT-3",
          amount: 100,
          unallocatedAmount: 0,
          allocations: [{ washEntryId: "entry-1", amount: 200 }],
        },
        "entry-1",
      ),
    { status: 409 },
  );
});
