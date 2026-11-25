import { Router } from "express";
import {
  getRolePermissions,
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
rolesRouter.put("/:role/permissions", updateRolePermissions);

export default rolesRouter;
