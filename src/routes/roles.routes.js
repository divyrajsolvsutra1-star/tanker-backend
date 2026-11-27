import { Router } from "express";
import {
  createRole,
  deleteRole,
  getRolePermissions,
  updateRole,
  updateRolePermissions,
} from "../controllers/roles.controller.js";
import {
  requireAuth,
  requireOwnerAdmin,
} from "../middleware/auth.js";
import { requireDatabase } from "../middleware/require-database.js";

const rolesRouter = Router();

rolesRouter.use(requireDatabase, requireAuth, requireOwnerAdmin);
rolesRouter.get("/permissions", getRolePermissions);
rolesRouter.post("/", createRole);
rolesRouter.put("/:role", updateRole);
rolesRouter.put("/:role/permissions", updateRolePermissions);
rolesRouter.delete("/:role", deleteRole);

export default rolesRouter;
