import { Router } from "express";
import { inviteUser, listUsers } from "../controllers/users.controller.js";
import {
  requireAuth,
  requireOwnerAdmin,
} from "../middleware/auth.js";
import { requireDatabase } from "../middleware/require-database.js";

const usersRouter = Router();

usersRouter.use(requireDatabase, requireAuth, requireOwnerAdmin);
usersRouter.get("/", listUsers);
usersRouter.post("/invitations", inviteUser);

export default usersRouter;
