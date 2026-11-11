// Servidor Node para previsualización y despliegues fuera de Vercel:
// sirve dist/ (SPA), la API en /api y, opcionalmente, un proxy a Supabase en
// /supabase para exponer todo bajo un único origen (útil en previsualizaciones).
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { app as api } from "./app.js";
import { securityHeaders } from "./security-headers.js";

const root = resolve(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);
const supabaseInternal = process.env.SUPABASE_PROXY_TARGET || "";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

const server = new Hono();

server.use("*", async (c, next) => {
  await next();
  if (!c.req.path.startsWith("/supabase/")) {
    for (const [k, v] of Object.entries(securityHeaders(supabaseInternal ? "" : process.env.VITE_SUPABASE_URL || ""))) {
      if (!c.res.headers.has(k)) c.header(k, v);
    }
  }
});

server.get("/sitemap.xml", (c) => api.fetch(new Request(new URL("/api/sitemap", c.req.url)), c.env));
server.get("/robots.txt", (c) => api.fetch(new Request(new URL("/api/robots", c.req.url)), c.env));
server.all("/api/*", (c) => api.fetch(c.req.raw, c.env));

if (supabaseInternal) {
  server.all("/supabase/*", async (c) => {
    const url = new URL(c.req.url);
    const target = new URL(url.pathname.replace(/^\/supabase/, "") + url.search, supabaseInternal);
    const headers = new Headers(c.req.raw.headers);
    headers.delete("host");
    const init: RequestInit & { duplex?: "half" } = { method: c.req.method, headers, redirect: "manual" };
    if (!["GET", "HEAD"].includes(c.req.method)) {
      init.body = c.req.raw.body;
      init.duplex = "half";
    }
    const res = await fetch(target, init);
    const out = new Headers(res.headers);
    out.delete("content-encoding");
    out.delete("content-length");
    return new Response(res.body, { status: res.status, headers: out });
  });
}

server.get("*", async (c) => {
  const path = decodeURIComponent(new URL(c.req.url).pathname);
  const file = normalize(join(root, path));
  if (file.startsWith(root)) {
    try {
      const s = await stat(file);
      if (s.isFile()) {
        const body = await readFile(file);
        const immutable = path.startsWith("/assets/");
        return c.body(body, 200, {
          "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
          "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300",
        });
      }
    } catch {
      /* no es un archivo: SPA */
    }
  }
  const html = await readFile(join(root, "index.html"), "utf8");
  return c.html(html, 200, { "Cache-Control": "no-cache" });
});

serve({ fetch: server.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`Novalius en http://localhost:${info.port}${supabaseInternal ? ` (proxy Supabase → ${supabaseInternal})` : ""}`);
});
