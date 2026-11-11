import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/**
 * En desarrollo, la API (server/app.ts) se sirve desde el propio Vite en /api,
 * con recarga en caliente. En producción la sirve Vercel (api/index.ts) o
 * server/node.ts.
 */
function apiDevServer(): Plugin {
  return {
    name: "novalius-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/") && url !== "/sitemap.xml") return next();
        if (url === "/sitemap.xml") req.url = "/api/sitemap";
        try {
          const { getRequestListener } = await import("@hono/node-server");
          const mod = (await server.ssrLoadModule("/server/app.ts")) as { app: { fetch: (r: Request) => Response | Promise<Response> } };
          await getRequestListener(mod.app.fetch)(req, res);
        } catch (e) {
          server.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Variables del servidor (sin prefijo VITE_) disponibles solo para la API en desarrollo
  const env = loadEnv(mode, process.cwd(), "");
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

  return {
    plugins: [react(), tailwindcss(), apiDevServer()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    build: {
      target: "es2022",
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/three/") || id.includes("@react-three")) return "three";
            if (id.includes("node_modules/motion") || id.includes("framer-motion")) return "motion";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("node_modules/react-router")) return "router";
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) return "react";
          },
        },
      },
    },
  };
});
