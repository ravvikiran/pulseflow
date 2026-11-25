import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Vite 8 bundles with Rolldown. Vendor libraries are split into stable,
    // separately cached chunks; everything else is split per route (lazy pages).
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: "vendor-react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
            { name: "vendor-motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 30 },
            { name: "vendor-charts", test: /node_modules[\\/](recharts|lightweight-charts|victory-vendor|d3-[^\\/]+|fancy-canvas)[\\/]/, priority: 30 },
            { name: "vendor-radix", test: /node_modules[\\/]@radix-ui[\\/]/, priority: 20 },
            { name: "vendor-query", test: /node_modules[\\/](@tanstack|@trpc|superjson)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
  },
});
