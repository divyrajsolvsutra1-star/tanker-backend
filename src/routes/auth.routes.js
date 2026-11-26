import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import {
  acceptInvitation,
  getCurrentUser,
  login,
  logout,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/require-database.js";

const authRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});
authRouter.use(requireDatabase);
authRouter.post("/login", loginLimiter, login);
authRouter.post("/invitations/accept", loginLimiter, acceptInvitation);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post("/logout", requireAuth, logout);

export default authRouter;
