import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In the bundled build this file lives at dist/index.js, so assets are in
  // dist/public. Running from source (e.g. `tsx` without NODE_ENV=development)
  // falls back to the repo-level dist/public.
  const bundledPath = path.resolve(import.meta.dirname, "public");
  const distPath = fs.existsSync(bundledPath)
    ? bundledPath
    : path.resolve(import.meta.dirname, "../..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        const rel = path.relative(distPath, filePath).replace(/\\/g, "/");
        if (rel.startsWith("assets/")) {
          // Vite emits content-hashed filenames here, safe to cache forever.
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (rel === "sw.js" || rel === "manifest.json") {
          // Must revalidate so service worker / manifest updates roll out.
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  // SPA fallback: always revalidate index.html so new deploys are picked up.
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
