// Cuenta del usuario: exportación de datos (RGPD) y solicitudes de privacidad.
import { Hono } from "hono";
import { z } from "zod";
import { readJson, tooMany } from "../lib/http.js";
import { admin, rateLimit, requireAuth } from "../lib/supabase.js";
import { notifyTeam } from "../notify/index.js";

export const account = new Hono();

account.get("/export", async (c) => {
  const auth = await requireAuth(c);
  if (!(await rateLimit(`export:${auth.user.id}`, 5, 3600))) throw tooMany();
  const db = admin();
  const uid = auth.user.id;
  const { data: profile } = await db.from("profiles").select("*").eq("id", uid).single();
  const email = profile?.email ?? auth.user.email ?? "";

  const [roles, quotes, leads, conversations, sessions, coupons, customer, privacy] = await Promise.all([
    db.from("user_roles").select("role, granted_at").eq("user_id", uid),
    db.from("quotes").select("reference, status, project_type, title, requirements, total_min, total_max, monthly_min, monthly_max, created_at, quote_items(label, min_amount, max_amount)").eq("user_id", uid),
    db.from("leads").select("id, name, company, email, phone, project_type, needs, status, source, consent_at, created_at").eq("email", email),
    db.from("conversations").select("id, title, created_at, messages(role, content, created_at)").eq("user_id", uid),
    db.from("game_sessions").select("game, status, difficulty, score, started_at, finished_at").eq("user_id", uid),
    db.from("coupons").select("code, percent, status, expires_at, created_at").eq("user_id", uid),
    db.from("customers").select("id, name, email, customer_projects(name, status, start_date, due_date)").eq("user_id", uid),
    db.from("privacy_requests").select("type, status, created_at, resolved_at").eq("user_id", uid),
  ]);

  const exportData = {
    generated_at: new Date().toISOString(),
    account: { id: uid, email, created_at: auth.user.created_at, email_confirmed_at: auth.user.email_confirmed_at },
    profile,
    roles: roles.data ?? [],
    quotes: quotes.data ?? [],
    leads: leads.data ?? [],
    // Nota: se incluyen las solicitudes enviadas con el correo de la cuenta.
    conversations: (conversations.data ?? []).map((cv) => ({ ...cv, messages: ((cv as { messages?: unknown[] }).messages ?? []).filter((m) => (m as { role: string }).role !== "event") })),
    games: sessions.data ?? [],
    coupons: coupons.data ?? [],
    customer: customer.data ?? [],
    privacy_requests: privacy.data ?? [],
  };
  await db.from("privacy_requests").insert({ user_id: uid, email, type: "access", status: "completed", details: "Exportación automática desde la cuenta", resolution: "Descarga generada", resolved_at: new Date().toISOString() });
  return c.body(JSON.stringify(exportData, null, 2), 200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="novalius-mis-datos-${new Date().toISOString().slice(0, 10)}.json"`,
    "Cache-Control": "no-store",
  });
});

account.post("/privacy-request", async (c) => {
  const auth = await requireAuth(c);
  if (!(await rateLimit(`privacy:${auth.user.id}`, 5, 86400))) throw tooMany();
  const body = await readJson(c, z.object({ type: z.enum(["deletion", "rectification"]), details: z.string().max(2000).default("") }));
  const { data: profile } = await admin().from("profiles").select("email").eq("id", auth.user.id).single();
  const { data, error } = await admin()
    .from("privacy_requests")
    .insert({ user_id: auth.user.id, email: profile?.email ?? auth.user.email ?? "", type: body.type, details: body.details })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("No se pudo registrar la solicitud");
  await notifyTeam({
    event: "privacy_request",
    title: body.type === "deletion" ? "Solicitud de supresión de datos" : "Solicitud de rectificación de datos",
    body: `${profile?.email ?? "Un usuario"} ha enviado una solicitud de ${body.type === "deletion" ? "supresión" : "rectificación"}.\n\n${body.details}`,
    link: "/admin/usuarios?tab=privacidad",
    entity: "privacy_requests",
    entityId: data.id,
  });
  return c.json({ ok: true, id: data.id });
});
