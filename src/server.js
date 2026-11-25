import app from "./app.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./config/database.js";
import { env } from "./config/env.js";

function startServer() {
  const server = app.listen(env.port, () => {
    console.log(`Tanker API listening on http://localhost:${env.port}`);
  });

  let retryTimer;
  const retryDelayMs = 5000;

  async function connectWithRetry() {
    try {
      await connectDatabase();
    } catch (error) {
      console.error(
        `MongoDB connection failed (${error.name}); check MONGODB_URI and database availability.`,
      );
      retryTimer = setTimeout(() => {
        void connectWithRetry();
      }, retryDelayMs);
    }
  }

  void connectWithRetry();

  const shutdown = (signal) => {
    console.log(`${signal} received; shutting down Tanker API.`);
    clearTimeout(retryTimer);
    server.close((error) => {
      if (error) {
        console.error("Failed to close the HTTP server cleanly:", error);
        process.exitCode = 1;
      }

      disconnectDatabase()
        .then(() => {
          if (!error) process.exitCode = 0;
        })
        .catch((disconnectError) => {
          console.error("Failed to disconnect from MongoDB:", disconnectError);
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer();
