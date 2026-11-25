import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  validatePassword,
  verifyPassword,
} from "../src/utils/security.js";

test("password hashing verifies only the original password", async () => {
  const hash = await hashPassword("correct horse battery staple");

  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("different password", hash), false);
});

test("password policy rejects values outside the supported length", () => {
  assert.equal(validatePassword("short"), false);
  assert.equal(validatePassword("long enough password"), true);
  assert.equal(validatePassword("x".repeat(129)), false);
});

test("opaque invitation tokens are high entropy and stored as one-way hashes", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();

  assert.notEqual(first, second);
  assert.notEqual(hashToken(first), first);
  assert.equal(hashToken(first).length, 64);
});
