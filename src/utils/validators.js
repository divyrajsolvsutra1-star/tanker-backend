export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidMobile(value) {
  return !value || MOBILE_REGEX.test(value);
}

export function isValidEmail(value) {
  return !value || EMAIL_REGEX.test(value);
}

export function isValidGst(value) {
  return !value || GST_REGEX.test(value);
}
