/**
 * Generate the next sequential code like `JV-2026-000018` or `TW-20261128-00001`
 * by looking up the highest existing value for the prefix instead of counting documents.
 */
export async function nextSequentialCode(Model, field, prefix, padLength = 6) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const latest = await Model.findOne({ [field]: { $regex: `^${escaped}-` } })
    .sort({ [field]: -1 })
    .select(field)
    .lean();

  let nextNum = 1;
  if (latest && typeof latest[field] === "string") {
    const parts = latest[field].split("-");
    const lastPart = Number.parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(lastPart) && lastPart >= 1) {
      nextNum = lastPart + 1;
    }
  }

  return `${prefix}-${String(nextNum).padStart(padLength, "0")}`;
}
