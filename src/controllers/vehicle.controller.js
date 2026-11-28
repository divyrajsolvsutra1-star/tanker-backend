import { Vehicle, normalizeVehiclePlate } from "../models/vehicle.model.js";
import { Customer } from "../models/customer.model.js";
import { AuditLog } from "../models/audit-log.model.js";

function httpError(status, message, field) {
  const err = new Error(message);
  err.status = status;
  if (field) err.field = field;
  return err;
}

export async function createVehicle(req, res, next) {
  try {
    const rawNumber = String(req.body.vehicleNumber || "").trim();
    if (!rawNumber) {
      throw httpError(400, "Vehicle / Tanker Number is required.", "vehicleNumber");
    }

    const cleanPlate = normalizeVehiclePlate(rawNumber);
    if (cleanPlate.length < 5) {
      throw httpError(400, "Enter a valid vehicle plate (e.g. GJ-05-MH-2005).", "vehicleNumber");
    }

    if (!req.body.customerId) {
      throw httpError(400, "Customer / Company Owner is required.", "customerId");
    }

    // Check if plate already registered (normalized, or case-insensitive regex ignoring dashes/spaces)
    const existing = await Vehicle.findOne({
      $or: [
        { normalizedNumber: cleanPlate },
        { vehicleNumber: { $regex: new RegExp(`^${cleanPlate.split("").join("[- ]?")}$`, "i") } }
      ]
    }).populate("customerId", "name");

    if (existing) {
      const ownerName = existing.customerId?.name || "another customer";
      throw httpError(
        409,
        `Vehicle plate '${existing.vehicleNumber}' is already registered with customer '${ownerName}'. Duplicate plate numbers are not permitted.`,
        "vehicleNumber"
      );
    }

    const item = await Vehicle.create({
      ...req.body,
      vehicleNumber: rawNumber.toUpperCase(),
      normalizedNumber: cleanPlate,
      createdBy: req.auth?._id
    });

    await AuditLog.create({
      userId: req.auth?._id,
      action: "create",
      entityType: "Vehicle",
      entityId: item._id,
      changes: item.toObject(),
      ipAddress: req.ip
    });

    res.status(201).json({ item });
  } catch (error) {
    if (error?.code === 11000) {
      return next(
        httpError(
          409,
          "This vehicle plate number is already registered in the system.",
          "vehicleNumber"
        )
      );
    }
    next(error);
  }
}

export async function updateVehicle(req, res, next) {
  try {
    const before = await Vehicle.findById(req.params.id).lean();
    if (!before) throw httpError(404, "Vehicle not found.");

    if (req.body.vehicleNumber) {
      const rawNumber = String(req.body.vehicleNumber).trim();
      const cleanPlate = normalizeVehiclePlate(rawNumber);

      if (cleanPlate.length < 5) {
        throw httpError(400, "Enter a valid vehicle plate (e.g. GJ-05-MH-2005).", "vehicleNumber");
      }

      const existing = await Vehicle.findOne({
        _id: { $ne: req.params.id },
        $or: [
          { normalizedNumber: cleanPlate },
          { vehicleNumber: { $regex: new RegExp(`^${cleanPlate.split("").join("[- ]?")}$`, "i") } }
        ]
      }).populate("customerId", "name");

      if (existing) {
        const ownerName = existing.customerId?.name || "another customer";
        throw httpError(
          409,
          `Vehicle plate '${existing.vehicleNumber}' is already registered with customer '${ownerName}'. Duplicate plate numbers are not permitted.`,
          "vehicleNumber"
        );
      }

      req.body.vehicleNumber = rawNumber.toUpperCase();
      req.body.normalizedNumber = cleanPlate;
    }

    const item = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    await AuditLog.create({
      userId: req.auth?._id,
      action: "update",
      entityType: "Vehicle",
      entityId: item._id,
      changes: { before, after: item.toObject() },
      ipAddress: req.ip
    });

    res.json({ item });
  } catch (error) {
    if (error?.code === 11000) {
      return next(
        httpError(
          409,
          "This vehicle plate number is already registered in the system.",
          "vehicleNumber"
        )
      );
    }
    next(error);
  }
}
