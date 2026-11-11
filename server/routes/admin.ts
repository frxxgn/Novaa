// Operaciones de administración que requieren la clave de servicio.
// Cada ruta comprueba permisos en servidor y deja rastro en audit_logs.
import { Hono } from "hono";
import { z } from "zod";
import { env, integrations } from "../env.js";
import { ApiError, badRequest, forbidden, notFound, readJson } from "../lib/http.js";
import { admin, clearSettingsCache, requirePermission, type AuthInfo } from "../lib/supabase.js";
import { notifyTeam } from "../notify/index.js";
import { invalidatePricingCache } from "../quotes/service.js";

export const adminRoutes = new Hono();

async function audit(auth: AuthInfo, action: string, entity: string, entityId: string, context: Record<string, unknown> = {}) {
  await admin().from("audit_logs").insert({ actor_id: auth.user.id, actor_email: auth.user.email ?? "", action, entity, entity_id: entityId, context });
}

adminRoutes.get("/integrations", async (c) => {
  await requirePermission(c, "dashboard.view");
  const missing = (names: string[]) => names.filter((n) => !process.env[n]);
  return c.json({
    supabase: { connected: integrations.supabase, missing: missing(["SUPABASE_URL", "SUPABASE_SECRET_KEY"]) },
    ai: { connected: integrations.ai, provider: "Anthropic (Claude)", missing: missing(["ANTHROPIC_API_KEY"]), mode: integrations.ai ? "IA conversacional" : "Modo guiado (sin IA)" },
    email: { connected: integrations.email, provider: env.emailProvider || null, missing: env.emailProvider === "resend" ? missing(["RESEND_API_KEY"]) : missing(["EMAIL_PROVIDER", "SMTP_HOST"]) },
    whatsapp: { connected: integrations.whatsapp, provider: "WhatsApp Business Cloud API (Meta)", missing: missing(["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]) },
    site_url: env.siteUrl,
  });
});

adminRoutes.post("/cache/clear", async (c) => {
  await requirePermission(c, "dashboard.view");
  clearSettingsCache();
  invalidatePricingCache();
  return c.json({ ok: true });
});

adminRoutes.post("/notifications/test", async (c) => {
  const auth = await requirePermission(c, "notifications.manage");
  const results = await notifyTeam({
    event: "test",
    title: "Prueba de notificaciones",
    body: `Mensaje de prueba enviado por ${auth.user.email} desde el panel de Novalius.`,
    link: "/admin/notificaciones",
    force: true,
  });
  await audit(auth, "notifications.test", "notifications", "test", { results });
  return c.json({ results });
});

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.string().trim().email().max(200),
  full_name: z.string().trim().max(120).default(""),
  role: z.enum(["user", "customer", "team", "admin"]).default("team"),
});

adminRoutes.post("/users/invite", async (c) => {
  const auth = await requirePermission(c, "users.manage");
  const body = await readJson(c, inviteSchema);
  if (body.role === "admin" && !auth.roles.includes("admin")) throw forbidden("Solo un administrador puede invitar administradores.");
  const db = admin();
  const { data: existing } = await db.from("profiles").select("id").eq("email", body.email.toLowerCase()).maybeSingle();
  let userId = existing?.id as string | undefined;
  let invited = false;
  if (!userId) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(body.email.toLowerCase(), {
      redirectTo: `${env.siteUrl}/auth/confirmar`,
      data: { full_name: body.full_name },
    });
    if (error || !data.user) throw new ApiError(400, "invite_failed", error?.message ?? "No se pudo enviar la invitación.");
    userId = data.user.id;
    invited = true;
  }
  if (body.role !== "user") {
    const { error } = await db.from("user_roles").upsert({ user_id: userId, role: body.role, granted_by: auth.user.id }, { onConflict: "user_id,role" });
    if (error) throw error;
  }
  await audit(auth, "users.invite", "profiles", userId, { email: body.email, role: body.role, invited });
  return c.json({ ok: true, user_id: userId, invited });
});

adminRoutes.post("/users/:id/disable", async (c) => {
  const auth = await requirePermission(c, "users.manage");
  const id = c.req.param("id");
  if (!z.uuid().safeParse(id).success) throw notFound();
  if (id === auth.user.id) throw badRequest("No puedes desactivar tu propia cuenta.");
  const body = await readJson(c, z.object({ disabled: z.boolean() }));
  const db = admin();
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", id);
  if ((roles ?? []).some((r) => r.role === "admin") && !auth.roles.includes("admin")) throw forbidden("Solo un administrador puede desactivar a otro administrador.");
  const { error: banError } = await db.auth.admin.updateUserById(id, { ban_duration: body.disabled ? "876000h" : "none" });
  if (banError) throw new ApiError(400, "update_failed", banError.message);
  await db.from("profiles").update({ is_disabled: body.disabled }).eq("id", id);
  await audit(auth, body.disabled ? "users.disable" : "users.enable", "profiles", id);
  return c.json({ ok: true });
});

adminRoutes.delete("/users/:id", async (c) => {
  const auth = await requirePermission(c, "users.manage");
  if (!auth.roles.includes("admin")) throw forbidden("Solo un administrador puede eliminar cuentas.");
  const id = c.req.param("id");
  if (!z.uuid().safeParse(id).success) throw notFound();
  if (id === auth.user.id) throw badRequest("No puedes eliminar tu propia cuenta desde aquí.");
  const db = admin();
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", id);
  if ((roles ?? []).some((r) => r.role === "admin")) {
    const { count } = await db.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) throw badRequest("No se puede eliminar el último administrador.");
  }
  const { data: profile } = await db.from("profiles").select("email").eq("id", id).maybeSingle();
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) throw new ApiError(400, "delete_failed", error.message);
  await audit(auth, "users.delete", "profiles", id, { email: profile?.email });
  return c.json({ ok: true });
});

// Invitar al portal a un cliente existente
adminRoutes.post("/customers/:id/invite", async (c) => {
  const auth = await requirePermission(c, "customers.manage");
  const id = c.req.param("id");
  if (!z.uuid().safeParse(id).success) throw notFound();
  const db = admin();
  const { data: customer } = await db.from("customers").select("id, email, contact_name, user_id").eq("id", id).maybeSingle();
  if (!customer) throw notFound("Cliente no encontrado.");
  let userId = customer.user_id as string | null;
  let invited = false;
  if (!userId) {
    const { data: profile } = await db.from("profiles").select("id").eq("email", customer.email).maybeSingle();
    userId = profile?.id ?? null;
    if (!userId) {
      const { data, error } = await db.auth.admin.inviteUserByEmail(customer.email, {
        redirectTo: `${env.siteUrl}/auth/confirmar`,
        data: { full_name: customer.contact_name },
      });
      if (error || !data.user) throw new ApiError(400, "invite_failed", error?.message ?? "No se pudo enviar la invitación.");
      userId = data.user.id;
      invited = true;
    }
    await db.from("customers").update({ user_id: userId }).eq("id", id);
  }
  await db.from("user_roles").upsert({ user_id: userId, role: "customer", granted_by: auth.user.id }, { onConflict: "user_id,role" });
  await audit(auth, "customers.invite", "customers", id, { invited });
  return c.json({ ok: true, user_id: userId, invited });
});

// ---------------------------------------------------------------------------
// Exportación del CRM (permiso específico crm.export)
// ---------------------------------------------------------------------------
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Evita la inyección de fórmulas al abrir el CSV en hojas de cálculo
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

adminRoutes.get("/leads/export", async (c) => {
  const auth = await requirePermission(c, "crm.export");
  const status = c.req.query("status");
  let q = admin().from("leads").select("created_at, name, company, email, phone, project_type, status, source, estimated_min, estimated_max, budget_range, timeline, needs").order("created_at", { ascending: false }).limit(5000);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  const header = ["Fecha", "Nombre", "Empresa", "Correo", "Teléfono", "Tipo de proyecto", "Estado", "Origen", "Estimación mín.", "Estimación máx.", "Presupuesto indicado", "Plazo", "Necesidades"];
  const rows = (data ?? []).map((l) => [l.created_at, l.name, l.company, l.email, l.phone, l.project_type, l.status, l.source, l.estimated_min, l.estimated_max, l.budget_range, l.timeline, l.needs].map(csvCell).join(","));
  await audit(auth, "crm.export", "leads", "csv", { rows: rows.length, status: status ?? "todos" });
  return c.body("﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n"), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="novalius-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    "Cache-Control": "no-store",
  });
});
