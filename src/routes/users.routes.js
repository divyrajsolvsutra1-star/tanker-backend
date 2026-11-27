import { Router } from "express";
import {
  activateUser,
  deleteUser,
  inviteUser,
  listUsers,
  updateUserRole,
} from "../controllers/users.controller.js";
import {
  requireAuth,
  requireOwnerAdmin,
} from "../middleware/auth.js";
import { requireDatabase } from "../middleware/require-database.js";

const usersRouter = Router();

usersRouter.use(requireDatabase, requireAuth, requireOwnerAdmin);
usersRouter.get("/", listUsers);
usersRouter.post("/invitations", inviteUser);
usersRouter.put("/:id/role", updateUserRole);
usersRouter.post("/:id/activate", activateUser);
usersRouter.delete("/:id", deleteUser);

export default usersRouter;
