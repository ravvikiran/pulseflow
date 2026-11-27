import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "node:http";
import net from "node:net";
import compression from "compression";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { closeDb } from "../db";
import { warmCaches } from "../dataProvider";
import { createContext } from "./context";
import { ENV } from "./env";
import { serveStatic, setupVite } from "./vite";
import {
  handleMarketDataRefresh,
  handleSectorScoring,
  handleSentimentUpdate,
  handleScannerProcessing,
  handleAlertEvaluation,
} from "../scheduledJobs";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function parseTrustProxy(value: string | undefined): boolean | number | string | undefined {
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  const n = Number(value);
  return Number.isInteger(n) ? n : value; // number of hops, or a subnet list
}

/**
 * Content-Security-Policy for production. Dev skips CSP because Vite injects
 * inline scripts and uses websockets for HMR.
 * - style-src 'unsafe-inline': Recharts, lightweight-charts and Framer Motion
 *   set inline styles.
 * - Fonts are self-hosted (served from this origin).
 */
const productionCsp = {
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'", "data:"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": ["'self'"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    // Often served over plain http on localhost; don't force https upgrades.
    "upgrade-insecure-requests": null,
  },
};

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.disable("x-powered-by");
  const trustProxy = parseTrustProxy(ENV.trustProxy);
  if (trustProxy !== undefined) app.set("trust proxy", trustProxy);

  // ─── Security & transport middleware ─────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: ENV.isDevelopment ? false : productionCsp,
      // HSTS only makes sense behind real TLS; leave it to the proxy otherwise.
      strictTransportSecurity: ENV.isProduction && trustProxy !== undefined,
    })
  );
  app.use(compression());

  // Largest legitimate payload is a small journal/settings JSON object.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // ─── Health check (before rate limiting so probes never get throttled) ───
  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store").json({
      status: "ok",
      uptime: Math.round(process.uptime()),
      database: ENV.databaseUrl ? "configured" : "not-configured",
      dataSource: "yahoo-finance",
      timestamp: new Date().toISOString(),
    });
  });

  if (ENV.apiRateLimitPerMin > 0 && ENV.nodeEnv !== "test") {
    app.use(
      "/api",
      rateLimit({
        windowMs: 60_000,
        limit: ENV.apiRateLimitPerMin,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Too many requests, please slow down." },
      })
    );
  }

  // ─── tRPC API ────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        // Client errors (bad input, not found) are expected; log only server faults.
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`[tRPC] ${path ?? "<unknown>"} failed:`, error.cause ?? error);
        }
      },
    })
  );

  // ─── Scheduled jobs (POST, protected by CRON_API_KEY) ────────────────────
  app.post("/api/scheduled/market-data-refresh", handleMarketDataRefresh);
  app.post("/api/scheduled/sector-scoring", handleSectorScoring);
  app.post("/api/scheduled/sentiment-update", handleSentimentUpdate);
  app.post("/api/scheduled/scanner-processing", handleScannerProcessing);
  app.post("/api/scheduled/alert-evaluation", handleAlertEvaluation);

  // Unknown API routes get a JSON 404 instead of falling through to the SPA.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // ─── Frontend: Vite middleware in dev, static files otherwise ────────────
  if (ENV.isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ─── Final error handler ─────────────────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status =
      typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
        ? err.status
        : 500;
    if (status >= 500) console.error("[HTTP] Unhandled error:", err);
    res.status(status).json({ error: status >= 500 ? "Internal server error" : "Bad request" });
  });

  // Port-hopping is a dev convenience only; in production fail fast on the
  // configured port so orchestration/health checks don't miss the server.
  const port = ENV.isDevelopment ? await findAvailablePort(ENV.port) : ENV.port;
  if (port !== ENV.port) {
    console.log(`Port ${ENV.port} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/ (${ENV.nodeEnv})`);

    // Fill the quote/history caches in the background (and keep them fresh) so
    // dashboards open quickly. Failures are non-fatal; requests fetch on demand.
    const warm = () =>
      warmCaches()
        .then(r => console.log(`[warmup] ${r.withHistory}/${r.symbols} symbols loaded`))
        .catch(error => console.warn("[warmup] failed:", (error as Error).message));
    void warm();
    setInterval(() => void warm(), 25 * 60 * 1000).unref();
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);

    // Hard stop if connections don't drain in time.
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();

    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", reason => {
  console.error("[process] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", error => {
  console.error("[process] Uncaught exception:", error);
  process.exit(1);
});

startServer().catch(error => {
  console.error("[startup] Failed to start server:", error);
  process.exit(1);
});
