// Aplicación API (Hono). Se ejecuta igual en local (Vite / Node) y en Vercel.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "./env.js";
import { ApiError } from "./lib/http.js";
import { admin } from "./lib/supabase.js";
import { account } from "./routes/account.js";
import { adminRoutes } from "./routes/admin.js";
import { games } from "./routes/games.js";
import { nova } from "./routes/nova.js";
import { pub } from "./routes/public.js";

export const app = new Hono().basePath("/api");

app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", c.res.headers.get("Cache-Control") ?? "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
});

// Protección CSRF: las peticiones que modifican datos deben venir del propio
// origen (la autenticación usa cabecera Bearer, no cookies, pero se refuerza).
app.use("*", async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !c.req.path.startsWith("/api/cron/")) {
    const origin = c.req.header("origin");
    if (origin) {
      const host = c.req.header("x-forwarded-host") || c.req.header("host") || "";
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      const allowed = new Set([host, new URL(env.siteUrl).host]);
      if (!allowed.has(originHost)) {
        return c.json({ error: { code: "forbidden_origin", message: "Origen no permitido." } }, 403);
      }
    }
  }
  await next();
});

app.route("/", pub);
app.route("/nova", nova);
app.route("/games", games);
app.route("/account", account);
app.route("/admin", adminRoutes);

// Tareas programadas (Vercel Cron) protegidas con CRON_SECRET
app.get("/cron/maintenance", async (c) => {
  const auth = c.req.header("authorization");
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) return c.json({ error: { code: "unauthorized", message: "No autorizado" } }, 401);
  const db = admin();
  const [{ data: retention }, { data: expired }] = await Promise.all([db.rpc("apply_retention"), db.rpc("expire_coupons")]);
  await db.from("game_sessions").update({ status: "expired", finished_at: new Date().toISOString() }).eq("status", "active").lt("deadline_at", new Date(Date.now() - 60 * 60_000).toISOString());
  return c.json({ ok: true, retention, expired_coupons: expired });
});

app.notFound((c) => c.json({ error: { code: "not_found", message: "Ruta no encontrada." } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: "http_error", message: err.message } }, err.status);
  }
  // Nunca se exponen trazas ni detalles internos al cliente
  console.error("[api]", c.req.method, c.req.path, err);
  return c.json({ error: { code: "internal_error", message: "Se ha producido un error inesperado. Inténtalo de nuevo." } }, 500);
});
