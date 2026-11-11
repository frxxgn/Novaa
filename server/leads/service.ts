// Registro de oportunidades comerciales (leads) con consentimiento explícito.
import { z } from "zod";
import { PROJECT_TYPE_LABELS, PROJECT_TYPES, formatEUR } from "../../src/shared/pricing.js";
import { admin, getSetting } from "../lib/supabase.js";
import { cleanText } from "../lib/http.js";
import { notifyTeam } from "../notify/index.js";

export const leadInputSchema = z.object({
  name: z.string().trim().min(1, "Indica tu nombre").max(120),
  email: z.string().trim().email("Correo no válido").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(160).optional().default(""),
  project_type: z.union([z.enum(PROJECT_TYPES), z.literal("")]).optional().default(""),
  message: z.string().trim().max(6000).optional().default(""),
  budget_range: z.string().trim().max(80).optional().default(""),
  timeline: z.string().trim().max(80).optional().default(""),
  whatsapp_opt_in: z.boolean().optional().default(false),
  consent: z.literal(true, { message: "Debes aceptar la política de privacidad" }),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

export interface LeadContext {
  source: "nova" | "contact_form" | "quote" | "template" | "challenge" | "manual";
  sourceDetail?: string;
  conversationId?: string | null;
  quoteId?: string | null;
  userId?: string | null;
  utm?: Record<string, string>;
}

export async function createLead(input: LeadInput, ctx: LeadContext) {
  const db = admin();
  const privacy = await getSetting("privacy", { consent_version: "2026-11" });

  let estimatedMin: number | null = null;
  let estimatedMax: number | null = null;
  let projectType = input.project_type || "";
  if (ctx.quoteId) {
    const { data: q } = await db.from("quotes").select("total_min, total_max, project_type").eq("id", ctx.quoteId).maybeSingle();
    if (q) {
      estimatedMin = Number(q.total_min);
      estimatedMax = Number(q.total_max);
      projectType = projectType || q.project_type;
    }
  }

  const { data: lead, error } = await db
    .from("leads")
    .insert({
      name: cleanText(input.name, 120),
      email: input.email.toLowerCase(),
      phone: cleanText(input.phone, 40),
      company: cleanText(input.company, 160),
      whatsapp_opt_in: input.whatsapp_opt_in,
      project_type: projectType,
      needs: cleanText(input.message, 6000),
      budget_range: cleanText(input.budget_range, 80),
      timeline: cleanText(input.timeline, 80),
      estimated_min: estimatedMin,
      estimated_max: estimatedMax,
      quote_id: ctx.quoteId ?? null,
      conversation_id: ctx.conversationId ?? null,
      user_id: ctx.userId ?? null,
      source: ctx.source,
      source_detail: cleanText(ctx.sourceDetail ?? "", 200),
      consent_at: new Date().toISOString(),
      consent_version: String(privacy.consent_version ?? ""),
      utm: ctx.utm ?? {},
    })
    .select("id, name, email, project_type, source, estimated_min, estimated_max")
    .single();
  if (error || !lead) throw error ?? new Error("No se pudo registrar la solicitud");

  if (ctx.quoteId) {
    await db.from("quotes").update({ lead_id: lead.id, status: "proposal_requested" }).eq("id", ctx.quoteId);
  }
  if (ctx.conversationId) {
    await db.from("conversations").update({ lead_id: lead.id }).eq("id", ctx.conversationId);
    await db.from("messages").insert({ conversation_id: ctx.conversationId, role: "event", content: "Solicitud enviada al equipo", payload: { type: "lead_created", lead_id: lead.id } });
  }

  const typeLabel = projectType ? PROJECT_TYPE_LABELS[projectType as keyof typeof PROJECT_TYPE_LABELS] ?? projectType : "Sin especificar";
  const estimate = estimatedMin !== null && estimatedMax !== null ? `${formatEUR(estimatedMin)} – ${formatEUR(estimatedMax)}` : "Sin estimación";
  await notifyTeam({
    event: ctx.quoteId ? "proposal_requested" : "new_lead",
    title: ctx.quoteId ? `Propuesta solicitada: ${lead.name}` : `Nuevo lead: ${lead.name}`,
    body: [
      `Origen: ${ctx.source}${ctx.sourceDetail ? ` (${ctx.sourceDetail})` : ""}`,
      `Contacto: ${lead.name} · ${lead.email}${input.phone ? ` · ${input.phone}` : ""}`,
      input.company ? `Empresa: ${input.company}` : "",
      `Proyecto: ${typeLabel}`,
      `Estimación: ${estimate}`,
      input.message ? `\n${input.message.slice(0, 800)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    link: `/admin/crm/${lead.id}`,
    entity: "leads",
    entityId: lead.id,
  });

  return lead;
}
