// Notificaciones reales: correo (SMTP o Resend), WhatsApp (Cloud API de Meta)
// e internas (panel). Cada intento queda registrado en notification_deliveries
// con su resultado real: nunca se marca como enviado algo que no se ha enviado.
import nodemailer, { type Transporter } from "nodemailer";
import { env, integrations } from "../env.js";
import { admin, getSetting } from "../lib/supabase.js";

export type NotifyEvent = "new_lead" | "proposal_requested" | "handoff" | "coupon_won" | "privacy_request" | "new_user" | "test";

interface NotificationSettings extends Record<string, unknown> {
  email: { enabled: boolean; recipients: string[] };
  whatsapp: { enabled: boolean; recipient: string; template: string };
  internal: { enabled: boolean };
  events: Partial<Record<NotifyEvent, boolean>>;
}

const DEFAULTS: NotificationSettings = {
  email: { enabled: true, recipients: [] },
  whatsapp: { enabled: false, recipient: "", template: "" },
  internal: { enabled: true },
  events: {},
};

const PERMISSION_FOR_EVENT: Record<NotifyEvent, string> = {
  new_lead: "crm.read",
  proposal_requested: "crm.read",
  handoff: "nova.conversations.read",
  coupon_won: "coupons.manage",
  privacy_request: "users.manage",
  new_user: "users.manage",
  test: "notifications.manage",
};

export interface NotifyPayload {
  event: NotifyEvent;
  title: string;
  body: string;
  link?: string;
  entity?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  /** Fuerza el envío aunque el evento esté desactivado (botón de prueba). */
  force?: boolean;
}

export interface DeliveryResult {
  channel: "email" | "whatsapp" | "internal";
  status: "sent" | "failed" | "skipped";
  detail: string;
  recipient?: string;
}

let transporter: Transporter | null = null;
function smtp(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function emailHtml(title: string, body: string, link?: string): string {
  const url = link ? (link.startsWith("http") ? link : `${env.siteUrl}${link}`) : "";
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4fd;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b0c26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e7e2fb">
<tr><td style="background:linear-gradient(135deg,#010f40,#6c26e8);padding:24px 28px;color:#fff;font-weight:700;letter-spacing:.08em;font-size:13px">NOVALIUS</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;margin:0 0 16px;color:#010f40">${escapeHtml(title)}</h1>
${paragraphs}
${url ? `<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#6c26e8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Abrir en el panel</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;color:#6b6890;font-size:12px;border-top:1px solid #efeafc">Mensaje automático de la plataforma Novalius.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(to: string[], subject: string, html: string, text: string): Promise<{ ok: boolean; id: string; error?: string; provider: string }> {
  if (!integrations.email) return { ok: false, id: "", error: "Correo no configurado (EMAIL_PROVIDER)", provider: "none" };
  try {
    if (env.emailProvider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.emailFrom, to, subject, html, text }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, id: "", error: json.message || `HTTP ${res.status}`, provider: "resend" };
      return { ok: true, id: json.id ?? "", provider: "resend" };
    }
    const info = await smtp().sendMail({ from: env.emailFrom, to, subject, html, text });
    return { ok: true, id: info.messageId ?? "", provider: "smtp" };
  } catch (e) {
    return { ok: false, id: "", error: e instanceof Error ? e.message : String(e), provider: env.emailProvider };
  }
}

/** WhatsApp Cloud API: requiere plantilla aprobada por Meta para iniciar conversaciones. */
export async function sendWhatsApp(to: string, template: string, params: string[]): Promise<{ ok: boolean; id: string; error?: string }> {
  if (!integrations.whatsapp) return { ok: false, id: "", error: "WhatsApp no configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" };
  if (!template) return { ok: false, id: "", error: "Falta el nombre de la plantilla aprobada en Meta" };
  const number = to.replace(/[^\d]/g, "");
  try {
    const res = await fetch(`https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsappToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: number,
        type: "template",
        template: {
          name: template,
          language: { code: "es" },
          components: params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p.slice(0, 200) })) }] : [],
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, id: "", error: json.error?.message || `HTTP ${res.status}` };
    return { ok: true, id: json.messages?.[0]?.id ?? "" };
  } catch (e) {
    return { ok: false, id: "", error: e instanceof Error ? e.message : String(e) };
  }
}

async function staffRecipients(permission: string): Promise<{ id: string; email: string }[]> {
  const db = admin();
  const { data: perms } = await db.from("role_permissions").select("role").eq("permission", permission);
  const roles = ["admin", ...(perms ?? []).map((p) => p.role as string)];
  const { data: rows } = await db.from("user_roles").select("user_id, profiles!inner(email, is_disabled)").in("role", roles);
  const seen = new Map<string, string>();
  for (const r of (rows ?? []) as unknown as { user_id: string; profiles: { email: string; is_disabled: boolean } }[]) {
    if (!r.profiles?.is_disabled) seen.set(r.user_id, r.profiles?.email ?? "");
  }
  return [...seen.entries()].map(([id, email]) => ({ id, email }));
}

async function logDelivery(p: NotifyPayload, r: DeliveryResult, provider = "", providerId = "") {
  await admin().from("notification_deliveries").insert({
    event: p.event,
    channel: r.channel,
    recipient: r.recipient ?? "",
    status: r.status,
    provider,
    provider_message_id: providerId,
    detail: r.detail.slice(0, 500),
    entity: p.entity ?? "",
    entity_id: p.entityId ?? "",
  });
}

/** Notifica al equipo por todos los canales activos. No lanza: registra fallos. */
export async function notifyTeam(p: NotifyPayload): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  try {
    const cfg = await getSetting<NotificationSettings>("notifications", DEFAULTS);
    const eventEnabled = p.force || cfg.events?.[p.event] !== false;
    if (!eventEnabled) {
      const r: DeliveryResult = { channel: "internal", status: "skipped", detail: `Evento ${p.event} desactivado` };
      await logDelivery(p, r);
      return [r];
    }

    // 1) Interna (panel)
    if (cfg.internal?.enabled !== false) {
      const recipients = await staffRecipients(PERMISSION_FOR_EVENT[p.event]);
      if (recipients.length) {
        const { error } = await admin().from("notifications").insert(
          recipients.map((u) => ({ recipient_id: u.id, type: p.event, title: p.title, body: p.body.slice(0, 1000), link: p.link ?? "", data: p.data ?? {} })),
        );
        const r: DeliveryResult = { channel: "internal", status: error ? "failed" : "sent", detail: error ? error.message : `${recipients.length} destinatario(s)`, recipient: `${recipients.length} usuarios` };
        results.push(r);
        await logDelivery(p, r, "panel");
      } else {
        const r: DeliveryResult = { channel: "internal", status: "skipped", detail: "No hay usuarios del equipo con permiso para este evento" };
        results.push(r);
        await logDelivery(p, r, "panel");
      }
    }

    // 2) Correo
    if (cfg.email?.enabled) {
      const to = (cfg.email.recipients ?? []).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (!to.length) {
        const r: DeliveryResult = { channel: "email", status: "skipped", detail: "Sin destinatarios configurados" };
        results.push(r);
        await logDelivery(p, r);
      } else {
        const sent = await sendEmail(to, `[Novalius] ${p.title}`, emailHtml(p.title, p.body, p.link), `${p.title}\n\n${p.body}${p.link ? `\n\n${env.siteUrl}${p.link}` : ""}`);
        const r: DeliveryResult = { channel: "email", status: sent.ok ? "sent" : integrations.email ? "failed" : "skipped", detail: sent.ok ? "Enviado" : sent.error ?? "Error", recipient: to.join(", ") };
        results.push(r);
        await logDelivery(p, r, sent.provider, sent.id);
      }
    }

    // 3) WhatsApp
    if (cfg.whatsapp?.enabled) {
      if (!cfg.whatsapp.recipient) {
        const r: DeliveryResult = { channel: "whatsapp", status: "skipped", detail: "Sin número de destino configurado" };
        results.push(r);
        await logDelivery(p, r);
      } else {
        const sent = await sendWhatsApp(cfg.whatsapp.recipient, cfg.whatsapp.template, [p.title, p.body.slice(0, 180)]);
        const r: DeliveryResult = { channel: "whatsapp", status: sent.ok ? "sent" : integrations.whatsapp ? "failed" : "skipped", detail: sent.ok ? "Enviado" : sent.error ?? "Error", recipient: cfg.whatsapp.recipient };
        results.push(r);
        await logDelivery(p, r, "meta", sent.id);
      }
    }
  } catch (e) {
    console.error("[notify]", e);
    results.push({ channel: "internal", status: "failed", detail: e instanceof Error ? e.message : String(e) });
  }
  return results;
}

/** Notificación interna para un usuario concreto (p. ej. un cliente). */
export async function notifyUser(userId: string, type: string, title: string, body: string, link = "") {
  await admin().from("notifications").insert({ recipient_id: userId, type, title, body, link });
}
