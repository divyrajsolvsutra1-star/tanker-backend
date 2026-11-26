import { Router } from "express";
import authRouter from "./auth.routes.js";
import healthRouter from "./health.routes.js";
import rolesRouter from "./roles.routes.js";
import usersRouter from "./users.routes.js";
import businessRouter from "./business.routes.js";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/roles", rolesRouter);
apiRouter.use(businessRouter);

export default apiRouter;
