import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Router tests call live public data sources (Yahoo Finance etc.), which are
    // rate-limited on purpose, so cold requests can take a while.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Run files one at a time so they share polite request pacing.
    fileParallelism: false,
  },
});
