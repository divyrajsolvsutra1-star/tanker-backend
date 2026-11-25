import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { env } from "../config/env.js";

const MFA_ISSUER = "Tanker Wash";

function getEncryptionKey() {
  if (!/^[0-9a-f]{64}$/i.test(env.mfaEncryptionKey)) {
    throw new Error(
      "MFA_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hexadecimal characters.",
    );
  }

  return Buffer.from(env.mfaEncryptionKey, "hex");
}

export function encryptMfaSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMfaSecret(encryptedSecret) {
  const [ivPart, tagPart, encryptedPart, ...extra] = encryptedSecret.split(".");
  if (!ivPart || !tagPart || !encryptedPart || extra.length > 0) {
    throw new Error("Stored MFA secret has an invalid format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createMfaSetup(email) {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: MFA_ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

export function verifyMfaCode(secretValue, code) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return false;
  }

  const totp = new TOTP({
    issuer: MFA_ISSUER,
    secret: Secret.fromBase32(secretValue),
    digits: 6,
    period: 30,
    algorithm: "SHA1",
  });

  return totp.validate({ token: code, window: 1 }) !== null;
}
