import mongoose from "mongoose";
import { AuditLog } from "../models/audit-log.model.js";

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function createCrudController(Model, searchFields = [], references = []) {
  async function log(req, action, entityId, changes) {
    await AuditLog.create({
      userId: req.auth?._id,
      action,
      entityType: Model.modelName,
      entityId,
      changes,
      ipAddress: req.ip
    });
  }

  return {
    async list(req, res, next) {
      try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const filter = {};
        for (const key of ["status", "active", "customerType", "category", "paymentMode", "paymentType", "washTypeId", "vehicleId", "customerId"]) {
          if (req.query[key] !== undefined && req.query[key] !== "") {
            if (key === "active") filter[key] = req.query[key] === "true";
            else if (["customerId","vehicleId","washTypeId"].includes(key) && mongoose.isValidObjectId(req.query[key])) filter[key] = req.query[key];
            else filter[key] = req.query[key];
          }
        }
        if (req.query.search && searchFields.length) {
          const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          filter.$or = searchFields.map((field) => ({ [field]: { $regex: escaped, $options: "i" } }));
        }
        const [items, total] = await Promise.all([
          Model.find(filter).populate(["customerId", "vehicleId", "washTypeId", "employeeIds", "accountId", "bankAccountId", "fromAccountId", "toAccountId"].filter((p) => Model.schema?.paths?.[p]).join(" ")).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
          Model.countDocuments(filter)
        ]);
        res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
      } catch (error) { next(error); }
    },
    async get(req, res, next) {
      try {
        const item = await Model.findById(req.params.id).populate(["customerId", "vehicleId", "washTypeId", "employeeIds", "accountId", "bankAccountId", "fromAccountId", "toAccountId"].filter((p) => Model.schema?.paths?.[p]).join(" ")).lean();
        if (!item) throw httpError(404, `${Model.modelName} not found.`);
        res.json({ item });
      } catch (error) { next(error); }
    },
    async create(req, res, next) {
      try {
        const item = await Model.create({ ...req.body, createdBy: req.auth?._id });
        await log(req, "create", item._id, item.toObject());
        res.status(201).json({ item });
      } catch (error) {
        if (error?.code === 11000) return next(httpError(409, "A duplicate record already exists."));
        next(error);
      }
    },
    async update(req, res, next) {
      try {
        const before = await Model.findById(req.params.id).lean();
        if (!before) throw httpError(404, `${Model.modelName} not found.`);
        const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        await log(req, "update", item._id, { before, after: item.toObject() });
        res.json({ item });
      } catch (error) { next(error); }
    },
    async remove(req, res, next) {
      try {
        const item = await Model.findById(req.params.id);
        if (!item) throw httpError(404, `${Model.modelName} not found.`);

        const linkedRecords = await Promise.all(
          references.map(async ({ model, field, label }) => {
            const count = await model.countDocuments({ [field]: item._id });
            return count > 0 ? `${label} (${count})` : null;
          }),
        );
        const blockingReferences = linkedRecords.filter(Boolean);
        if (blockingReferences.length > 0) {
          throw httpError(
            409,
            `Cannot delete this ${Model.modelName}; it is referenced by ${blockingReferences.join(", ")}. Remove those records first.`,
          );
        }

        const deleted = await Model.deleteOne({ _id: item._id });
        if (deleted.deletedCount !== 1) {
          throw httpError(404, `${Model.modelName} not found.`);
        }

        await log(req, "delete", item._id, item.toObject());
        res.status(204).end();
      } catch (error) { next(error); }
    }
  };
}
