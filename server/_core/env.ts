import { z } from "zod";

/**
 * Centralised, validated environment config.
 * Parsed once at startup so misconfiguration fails fast with a clear message
 * instead of surfacing later as an obscure runtime error.
 */
const EnvSchema = z.object({
  NODE_ENV: z.string().trim().default("production"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .trim()
    .optional()
    .transform(v => (v ? v : undefined)),
  CRON_API_KEY: z
    .string()
    .optional()
    .transform(v => (v ? v : undefined)),
  // Comma-separated proxy hop count or "true"/"false" for Express `trust proxy`.
  TRUST_PROXY: z.string().optional(),
  // Requests per minute per IP on /api (0 disables the limiter).
  API_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(0).default(300),
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;

  // Soft checks: warn instead of refusing to boot, so existing setups keep working.
  if (e.DATABASE_URL && !/^mysql2?:\/\//.test(e.DATABASE_URL)) {
    console.warn("[env] DATABASE_URL does not look like a mysql:// connection string");
  }
  if (e.CRON_API_KEY && e.CRON_API_KEY.length < 16) {
    console.warn("[env] CRON_API_KEY is shorter than 16 characters; use a longer random value");
  }
  if (e.NODE_ENV === "production" && !e.CRON_API_KEY) {
    console.warn("[env] CRON_API_KEY is not set; /api/scheduled/* endpoints are disabled in production");
  }

  return {
    nodeEnv: e.NODE_ENV,
    isProduction: e.NODE_ENV === "production",
    isDevelopment: e.NODE_ENV === "development",
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    cronApiKey: e.CRON_API_KEY,
    trustProxy: e.TRUST_PROXY,
    apiRateLimitPerMin: e.API_RATE_LIMIT_PER_MIN,
  };
}

export const ENV = loadEnv();
