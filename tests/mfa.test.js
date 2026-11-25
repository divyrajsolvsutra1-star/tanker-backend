import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MFA_ENCRYPTION_KEY ??= "3f".repeat(32);

const { Secret, TOTP } = await import("otpauth");
const {
  createMfaSetup,
  decryptMfaSecret,
  encryptMfaSecret,
  verifyMfaCode,
} = await import("../src/utils/mfa.js");

test("MFA secrets are encrypted at rest and decrypt without alteration", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const encrypted = encryptMfaSecret(secret);

  assert.notEqual(encrypted, secret);
  assert.equal(decryptMfaSecret(encrypted), secret);
});

test("TOTP setup URI verifies codes from authenticator-compatible secrets", () => {
  const setup = createMfaSetup("owner@example.com");
  const totp = new TOTP({
    issuer: "Tanker Wash",
    label: "owner@example.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(setup.secret),
  });

  assert.match(setup.uri, /^otpauth:\/\/totp\//);
  assert.equal(verifyMfaCode(setup.secret, totp.generate()), true);
  assert.equal(verifyMfaCode(setup.secret, "not-a-code"), false);
});

test("tampered MFA ciphertext is rejected", () => {
  const encrypted = encryptMfaSecret("secret");
  const [iv, tag, ciphertext] = encrypted.split(".");
  const replacement = `${iv}.${tag}.${ciphertext.slice(0, -1)}A`;

  assert.throws(() => decryptMfaSecret(replacement));
});
