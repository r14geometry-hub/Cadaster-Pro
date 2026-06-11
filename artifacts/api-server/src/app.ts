import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const IS_PROD = process.env.NODE_ENV === "production";

// ─── CORS origins ───────────────────────────────────────────────────────────
// ALLOWED_ORIGIN may be a comma-separated list: "https://24kadastr.ru,https://www.24kadastr.ru"
// In development without the variable, all origins are allowed.
// In production without the variable, index.ts will already have thrown.
function buildCorsOrigin(): string | string[] | boolean {
  const raw = process.env.ALLOWED_ORIGIN;
  if (raw) {
    const origins = raw.split(",").map((o) => o.trim()).filter(Boolean);
    return origins.length === 1 ? origins[0] : origins;
  }
  if (IS_PROD) {
    // Fallback for 24kadastr.ru if somehow ALLOWED_ORIGIN was not set
    return ["https://24kadastr.ru", "https://www.24kadastr.ru"];
  }
  return true; // dev: allow all
}

const app: Express = express();

// ─── Security headers (helmet) ──────────────────────────────────────────────
app.use(
  helmet({
    hsts: IS_PROD
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    contentSecurityPolicy: false, // CSP managed by frontend
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: buildCorsOrigin(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ─── Request logging ─────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
