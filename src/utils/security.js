import {
  createHash,
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(callbackScrypt);
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

export function validatePassword(password) {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

export async function hashPassword(password) {
  if (!validatePassword(password)) {
    throw Object.assign(
      new Error("Password must be between 12 and 128 characters."),
      { status: 400 },
    );
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== "string" || typeof encodedHash !== "string") {
    return false;
  }

  const [algorithm, saltHex, hashHex, ...extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[0-9a-f]{32}$/i.test(saltHex ?? "") ||
    !/^[0-9a-f]{128}$/i.test(hashHex ?? "") ||
    extra.length > 0
  ) {
    return false;
  }

  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return timingSafeEqual(actual, expected);
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
