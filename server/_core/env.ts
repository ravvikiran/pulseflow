const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === "production") {
  console.error("[SECURITY] JWT_SECRET is not set! Sessions are insecure. Set JWT_SECRET environment variable.");
}

export const ENV = {
  cookieSecret: jwtSecret ?? "pulseflow-dev-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT || "3000"),
};
