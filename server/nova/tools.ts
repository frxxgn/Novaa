// Herramientas de Nova. El modelo SOLO puede: estimar (con el motor del
// servidor), proponer un envío de contacto (que el usuario confirma en la
// interfaz) y derivar al equipo. No puede cambiar precios ni configuración.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  COMPLEXITY_LEVELS,
  DESIGN_LEVELS,
  FEATURE_KEYS,
  MAINTENANCE_PLANS,
  PROJECT_TYPES,
  TIMELINES,
  quoteRequirementsSchema,
  type QuoteSummary,
} from "../../src/shared/pricing.js";
import { admin } from "../lib/supabase.js";
import { createQuote } from "../quotes/service.js";
import { notifyTeam } from "../notify/index.js";
import type { NovaConfig } from "./config.js";

export type NovaEvent =
  | { type: "delta"; text: string }
  | { type: "status"; text: string }
  | { type: "quote"; quote: QuoteSummary }
  | { type: "contact_request"; prefill: ContactPrefill }
  | { type: "handoff"; message: string }
  | { type: "quick_replies"; options: string[]; multi?: boolean }
  | { type: "notice"; text: string };

export interface ContactPrefill {
  name: string;
  email: string;
  phone: string;
  company: string;
  summary: string;
  quote_id: string | null;
}

export interface ToolContext {
  conversationId: string;
  userId: string | null;
  emit: (e: NovaEvent) => void;
  /** Presupuesto calculado en esta petición (con token si es anónimo). */
  lastQuote?: QuoteSummary;
}

export function toolDefinitions(cfg: NovaConfig): Anthropic.Beta.BetaTool[] {
  const tools: Anthropic.Beta.BetaTool[] = [];
  if (cfg.tools.estimate_quote) {
    tools.push({
      name: "estimate_project_quote",
      description:
        "Calcula un presupuesto orientativo con las tarifas oficiales de Novalius a partir de los requisitos del proyecto. Úsala cuando conozcas al menos el tipo de proyecto y las funcionalidades principales. Devuelve el rango de precio, el desglose y los supuestos aplicados. Nunca des cifras que no procedan de esta herramienta.",
      input_schema: {
        type: "object",
        properties: {
          project_type: { type: "string", enum: [...PROJECT_TYPES], description: "Tipo principal de proyecto." },
          title: { type: "string", description: "Título breve del proyecto, p. ej. «Web para restaurante con reservas»." },
          business: { type: "string", description: "Tipo de negocio del usuario." },
          pages: { type: "integer", minimum: 0, maximum: 200, description: "Número aproximado de páginas (si aplica)." },
          design: { type: "string", enum: [...DESIGN_LEVELS], description: "template = partir de plantilla; custom = diseño a medida; premium = animaciones avanzadas y 3D." },
          features: { type: "array", items: { type: "string", enum: [...FEATURE_KEYS] }, description: "Funcionalidades solicitadas." },
          quantities: {
            type: "object",
            properties: {
              multilingual: { type: "integer", minimum: 0, description: "Idiomas adicionales." },
              integration: { type: "integer", minimum: 0, description: "Número de integraciones." },
              automation: { type: "integer", minimum: 0, description: "Número de flujos automatizados." },
              copywriting: { type: "integer", minimum: 0, description: "Páginas a redactar." },
            },
            additionalProperties: false,
          },
          complexity: { type: "string", enum: [...COMPLEXITY_LEVELS] },
          timeline: { type: "string", enum: [...TIMELINES], description: "rush = urgente; flexible = sin prisa." },
          maintenance: { type: "string", enum: [...MAINTENANCE_PLANS] },
          notes: { type: "string", description: "Supuestos o detalles relevantes." },
        },
        required: ["project_type", "features"],
        additionalProperties: false,
      },
    });
  }
  if (cfg.tools.request_contact) {
    tools.push({
      name: "request_contact",
      description:
        "Prepara el envío de los datos de contacto del usuario al equipo de Novalius para que reciba una propuesta personalizada. Úsala solo cuando el usuario quiera una propuesta o que le contacten y te haya dado al menos su nombre y su correo. La interfaz le pedirá confirmar el envío y aceptar la política de privacidad; el envío NO se realiza hasta que confirme.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          summary: { type: "string", description: "Resumen del proyecto y necesidades en 2-5 frases para el equipo comercial." },
        },
        required: ["name", "email", "summary"],
        additionalProperties: false,
      },
    });
  }
  if (cfg.tools.handoff) {
    tools.push({
      name: "handoff_to_team",
      description:
        "Avisa al equipo de Novalius de que el usuario necesita atención humana (lo pide expresamente, la consulta excede tu conocimiento o hay una queja). Después ofrece recoger sus datos de contacto.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Motivo de la derivación." },
        },
        required: ["reason"],
        additionalProperties: false,
      },
    });
  }
  return tools;
}

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(160).optional().default(""),
  summary: z.string().trim().min(1).max(2000),
});

const handoffSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  try {
    if (name === "estimate_project_quote") {
      const parsed = quoteRequirementsSchema.safeParse(input);
      if (!parsed.success) {
        return { isError: true, content: `Parámetros no válidos: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
      }
      ctx.emit({ type: "status", text: "Calculando presupuesto orientativo…" });
      const quote = await createQuote(parsed.data, { userId: ctx.userId, conversationId: ctx.conversationId, source: "nova" });
      ctx.lastQuote = quote;
      ctx.emit({ type: "quote", quote });
      return {
        isError: false,
        content: JSON.stringify({
          referencia: quote.reference,
          proyecto: quote.title,
          rango: `${quote.total_min}–${quote.total_max} ${quote.currency}`,
          mensual: quote.monthly_max > 0 ? `${quote.monthly_min}–${quote.monthly_max} ${quote.currency}/mes` : null,
          desglose: quote.items.map((i) => `${i.label}: ${i.min}–${i.max}`),
          incluido: quote.included,
          opcionales: quote.optional.map((o) => o.label),
          supuestos: quote.assumptions,
          nota_iva: quote.vat_note,
          aviso: "La interfaz ya muestra al usuario la tarjeta con el desglose completo. Resume el rango en una frase, menciona 1-2 factores clave y pregunta si quiere una propuesta personalizada.",
        }),
      };
    }

    if (name === "request_contact") {
      const parsed = contactSchema.safeParse(input);
      if (!parsed.success) {
        return { isError: true, content: "Faltan datos válidos: necesito nombre, un correo electrónico válido y un resumen." };
      }
      const { data: conv } = await admin().from("conversations").select("quote_id").eq("id", ctx.conversationId).maybeSingle();
      ctx.emit({
        type: "contact_request",
        prefill: { ...parsed.data, quote_id: ctx.lastQuote?.id ?? conv?.quote_id ?? null },
      });
      return {
        isError: false,
        content: "La interfaz muestra ahora al usuario una tarjeta para revisar sus datos, aceptar la política de privacidad y confirmar el envío. Todavía NO se ha enviado nada: dile que revise la tarjeta y pulse «Enviar al equipo».",
      };
    }

    if (name === "handoff_to_team") {
      const parsed = handoffSchema.safeParse(input);
      if (!parsed.success) return { isError: true, content: "Indica el motivo de la derivación." };
      await admin().from("conversations").update({ status: "handoff" }).eq("id", ctx.conversationId);
      await admin().from("messages").insert({ conversation_id: ctx.conversationId, role: "event", content: "Derivación al equipo", payload: { type: "handoff", reason: parsed.data.reason } });
      await notifyTeam({
        event: "handoff",
        title: "Nova solicita atención humana",
        body: `Motivo: ${parsed.data.reason}`,
        link: `/admin/nova/conversaciones/${ctx.conversationId}`,
        entity: "conversations",
        entityId: ctx.conversationId,
      });
      ctx.emit({ type: "handoff", message: "Equipo avisado" });
      return { isError: false, content: "Equipo avisado (notificación interna registrada). Ofrece al usuario dejar su nombre y correo para que le escriban." };
    }

    return { isError: true, content: `Herramienta desconocida: ${name}` };
  } catch (e) {
    console.error(`[nova:tool:${name}]`, e);
    return { isError: true, content: "La herramienta ha fallado. Discúlpate brevemente y ofrece el formulario de contacto." };
  }
}
