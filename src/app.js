import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { requireSameOrigin } from "./middleware/require-same-origin.js";
import apiRouter from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/api", requireSameOrigin);
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
