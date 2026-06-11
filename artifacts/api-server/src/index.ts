import app from "./app";
import { logger } from "./lib/logger";
import { seedLeadPricesIfEmpty } from "./lib/seed-lead-prices";
import { seedRegionsIfEmpty } from "./lib/seed-regions";
import { startReverificationScheduler } from "./services/reverification-scheduler";

// ─── Startup environment validation ────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[STARTUP] Required environment variable "${name}" is not set. ` +
        "The server cannot start without it."
    );
  }
  return value;
}

function warnEnv(name: string, message: string): void {
  if (!process.env[name]) {
    logger.warn({ variable: name }, `[STARTUP] ${message}`);
  }
}

// Always required
requireEnv("SESSION_SECRET");
requireEnv("DATABASE_URL");

const rawPort = requireEnv("PORT");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Required in production
if (IS_PROD) {
  requireEnv("ALLOWED_ORIGIN");
}

// Warn about degraded features
warnEnv(
  "DADATA_API_KEY",
  "DADATA_API_KEY is not set — address autocomplete will return HTTP 503 in production."
);

if (!IS_PROD) {
  warnEnv(
    "ALLOWED_ORIGIN",
    "ALLOWED_ORIGIN is not set — CORS will allow all origins in development."
  );
}

// ─── Start server ───────────────────────────────────────────────────────────

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "Server listening");
  seedLeadPricesIfEmpty().catch((e) => logger.error({ err: e }, "Seed failed"));
  seedRegionsIfEmpty().catch((e) => logger.error({ err: e }, "Region seed failed"));
  startReverificationScheduler();
});
