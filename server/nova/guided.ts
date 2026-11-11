// Modo guiado de Nova: se usa cuando no hay proveedor de IA configurado.
// Es un flujo de cualificación determinista (no simula ser una IA) que adapta
// las preguntas al tipo de proyecto y calcula el presupuesto con el mismo
// motor del servidor.
import { FEATURE_LABELS, type FeatureKey, type ProjectType, type QuoteRequirements } from "../../src/shared/pricing.js";

export interface GuidedData {
  project_type?: ProjectType;
  business?: string;
  goal?: string;
  has_site?: boolean;
  features?: FeatureKey[];
  pages?: number;
  design?: "template" | "custom" | "premium";
  admin?: boolean;
  integrations?: number;
  automations?: number;
  timeline?: "flexible" | "standard" | "rush";
  budget?: string;
}

export interface GuidedState {
  step: string;
  data: GuidedData;
  quoted?: boolean;
}

export interface GuidedReply {
  state: GuidedState;
  text: string;
  options: string[];
  multi?: boolean;
  quote?: QuoteRequirements;
  contact?: boolean;
  restart?: boolean;
}

const TYPE_OPTIONS: [string, ProjectType][] = [
  ["Web corporativa", "web"],
  ["Tienda online", "ecommerce"],
  ["Landing page", "landing"],
  ["Aplicación web a medida", "webapp"],
  ["Asistente o chatbot con IA", "ai_assistant"],
  ["Automatizar tareas", "automation"],
  ["Panel administrativo", "admin_panel"],
  ["Rediseñar mi web", "redesign"],
  ["SEO y posicionamiento", "seo"],
  ["Mantenimiento", "maintenance"],
];

const TYPE_KEYWORDS: [RegExp, ProjectType][] = [
  [/redise|renovar|antigu|actualizar mi web/i, "redesign"],
  [/tienda|ecommerce|e-commerce|vender online|venta online|carrito/i, "ecommerce"],
  [/chatbot|asistente|\bia\b|inteligencia artificial|bot/i, "ai_assistant"],
  [/automat/i, "automation"],
  [/panel|backoffice|dashboard/i, "admin_panel"],
  [/\bseo\b|google|posicion/i, "seo"],
  [/mantenimiento|soporte/i, "maintenance"],
  [/base de datos|gesti[oó]n de datos|crm/i, "database"],
  [/integra|conectar|api/i, "integration"],
  [/landing/i, "landing"],
  [/aplicaci[oó]n|\bapp\b|plataforma|portal|saas|software/i, "webapp"],
  [/web|p[aá]gina/i, "web"],
];

const FEATURE_KEYWORDS: [RegExp, FeatureKey][] = [
  [/reserva|cita|agenda/i, "booking"],
  [/blog|noticia|art[ií]culo/i, "blog_cms"],
  [/idioma|ingl[eé]s|multiling/i, "multilingual"],
  [/pago|cobr|pasarela/i, "payments"],
  [/cat[aá]logo|producto/i, "ecommerce_catalog"],
  [/usuario|registro|login|cuenta/i, "user_accounts"],
  [/portal|[aá]rea de cliente|zona privada/i, "client_portal"],
  [/chat|asistente|\bia\b/i, "chatbot_ai"],
  [/seo|google/i, "seo_setup"],
  [/anal[ií]tica|m[eé]trica|estad[ií]stica/i, "analytics_setup"],
  [/texto|redacci|contenido/i, "copywriting"],
  [/formulario|contacto/i, "contact_forms"],
];

const FEATURES_BY_TYPE: Partial<Record<ProjectType, FeatureKey[]>> = {
  landing: ["contact_forms", "booking", "chatbot_ai", "seo_setup", "analytics_setup", "copywriting"],
  web: ["booking", "blog_cms", "multilingual", "chatbot_ai", "user_accounts", "seo_setup", "analytics_setup", "copywriting"],
  redesign: ["booking", "blog_cms", "multilingual", "chatbot_ai", "seo_setup", "analytics_setup", "copywriting"],
  ecommerce: ["multilingual", "user_accounts", "chatbot_ai", "blog_cms", "seo_setup", "analytics_setup"],
  webapp: ["client_portal", "payments", "booking", "chatbot_ai", "multilingual", "analytics_setup"],
  admin_panel: ["client_portal", "database_custom", "analytics_setup"],
  ai_assistant: ["booking", "multilingual", "analytics_setup"],
  automation: ["chatbot_ai", "analytics_setup"],
  database: ["admin_panel", "user_accounts", "analytics_setup"],
  integration: ["payments", "analytics_setup"],
  seo: ["copywriting", "analytics_setup", "blog_cms"],
  maintenance: [],
};

const WEB_TYPES: ProjectType[] = ["landing", "web", "ecommerce", "redesign", "webapp", "admin_panel"];
const NONE = "Ninguna en especial";
export const RESTART_LABEL = "Empezar de nuevo";
export const PROPOSAL_LABEL = "Sí, quiero una propuesta";
export const SAVE_LABEL = "Guardar presupuesto";

const ack = ["Perfecto.", "Genial.", "Entendido.", "Muy bien.", "De acuerdo."];
const pick = (seed: number) => ack[seed % ack.length]!;

interface StepDef {
  id: string;
  skip?: (d: GuidedData) => boolean;
  ask: (d: GuidedData) => string;
  options: (d: GuidedData) => string[];
  multi?: boolean;
  /** Devuelve false si la respuesta no se entiende. */
  parse: (d: GuidedData, text: string, choices: string[]) => boolean;
}

const yes = (t: string) => /^(s[ií]|claro|vale|por supuesto|ok|afirmativo|si,|sí,)/i.test(t.trim());
const no = (t: string) => /^(no|nada|ninguna|ninguno)/i.test(t.trim());

function countFrom(text: string): number | null {
  if (/ninguna|ninguno|^no\b|^0/i.test(text)) return 0;
  if (/3 o m[aá]s|m[aá]s de/i.test(text)) return 3;
  if (/1 o 2|una o dos|uno o dos/i.test(text)) return 2;
  const n = /(\d+)/.exec(text);
  return n ? Math.min(50, Number(n[1])) : null;
}

const STEPS: StepDef[] = [
  {
    id: "type",
    ask: () => "¿Qué te gustaría construir o mejorar?",
    options: () => TYPE_OPTIONS.map(([l]) => l),
    parse: (d, text) => {
      const exact = TYPE_OPTIONS.find(([l]) => l.toLowerCase() === text.trim().toLowerCase());
      const match = exact?.[1] ?? TYPE_KEYWORDS.find(([re]) => re.test(text))?.[1];
      if (!match) return false;
      d.project_type = match;
      return true;
    },
  },
  {
    id: "business",
    ask: () => "¿A qué se dedica tu negocio? Con una frase me basta.",
    options: () => ["Restauración", "Salud y bienestar", "Comercio", "Servicios profesionales", "Construcción", "Otro sector"],
    parse: (d, text) => {
      if (text.trim().length < 2) return false;
      d.business = text.trim().slice(0, 200);
      return true;
    },
  },
  {
    id: "goal",
    ask: () => "¿Cuál es el objetivo principal del proyecto?",
    options: () => ["Conseguir más clientes", "Vender online", "Ahorrar tiempo", "Mejorar mi imagen", "Otro"],
    parse: (d, text) => {
      if (!text.trim()) return false;
      d.goal = text.trim().slice(0, 200);
      return true;
    },
  },
  {
    id: "has_site",
    skip: (d) => d.project_type === "redesign" || d.project_type === "maintenance" || d.project_type === "seo",
    ask: () => "¿Tienes web actualmente?",
    options: () => ["Sí, ya tengo web", "No, todavía no"],
    parse: (d, text) => {
      if (yes(text)) d.has_site = true;
      else if (no(text)) d.has_site = false;
      else return false;
      return true;
    },
  },
  {
    id: "features",
    skip: (d) => (FEATURES_BY_TYPE[d.project_type!] ?? []).length === 0,
    multi: true,
    ask: () => "¿Qué funcionalidades necesitas? Puedes elegir varias.",
    options: (d) => [...(FEATURES_BY_TYPE[d.project_type!] ?? []).map((f) => FEATURE_LABELS[f]), NONE],
    parse: (d, text, choices) => {
      const picked = new Set<FeatureKey>();
      const labels = Object.entries(FEATURE_LABELS) as [FeatureKey, string][];
      for (const c of choices) {
        const hit = labels.find(([, l]) => l === c);
        if (hit) picked.add(hit[0]);
      }
      if (!choices.length) {
        for (const [re, key] of FEATURE_KEYWORDS) if (re.test(text)) picked.add(key);
        if (!picked.size && !no(text) && !/ninguna en especial/i.test(text)) return false;
      }
      d.features = [...picked];
      return true;
    },
  },
  {
    id: "pages",
    skip: (d) => !["web", "ecommerce", "redesign", "webapp"].includes(d.project_type!),
    ask: () => "¿Cuántas páginas o secciones principales calculas?",
    options: () => ["1–3", "4–6", "7–10", "Más de 10"],
    parse: (d, text) => {
      if (/m[aá]s de 10/i.test(text)) d.pages = 14;
      else if (/7/.test(text)) d.pages = 8;
      else if (/4/.test(text)) d.pages = 5;
      else if (/1/.test(text)) d.pages = 3;
      else {
        const n = /(\d+)/.exec(text);
        if (!n) return false;
        d.pages = Math.min(200, Number(n[1]));
      }
      return true;
    },
  },
  {
    id: "design",
    skip: (d) => !WEB_TYPES.includes(d.project_type!),
    ask: () => "¿Qué nivel de diseño buscas?",
    options: () => ["Partir de una plantilla", "Diseño a medida", "Premium con animaciones y 3D"],
    parse: (d, text) => {
      if (/plantilla/i.test(text)) d.design = "template";
      else if (/premium|3d|animaci/i.test(text)) d.design = "premium";
      else if (/medida|personaliz|propio/i.test(text)) d.design = "custom";
      else return false;
      return true;
    },
  },
  {
    id: "admin",
    skip: (d) => ["admin_panel", "webapp", "maintenance", "seo", "automation", "integration", "database", "ai_assistant"].includes(d.project_type!),
    ask: () => "¿Necesitarás un panel para gestionar contenidos, pedidos o clientes sin tocar código?",
    options: () => ["Sí", "No"],
    parse: (d, text) => {
      if (yes(text)) d.admin = true;
      else if (no(text)) d.admin = false;
      else return false;
      return true;
    },
  },
  {
    id: "integrations",
    skip: (d) => ["maintenance", "seo"].includes(d.project_type!),
    ask: () => "¿Tiene que conectarse con otras herramientas (CRM, facturación, pagos, calendario…)?",
    options: () => ["Ninguna", "1 o 2", "3 o más"],
    parse: (d, text) => {
      const n = countFrom(text);
      if (n === null) return false;
      d.integrations = n;
      return true;
    },
  },
  {
    id: "automations",
    skip: (d) => ["maintenance", "seo"].includes(d.project_type!),
    ask: (d) => (d.project_type === "automation" ? "¿Cuántos procesos quieres automatizar?" : "¿Te gustaría automatizar algún proceso (avisos, respuestas, documentos…)?"),
    options: (d) => (d.project_type === "automation" ? ["1", "1 o 2", "3 o más"] : ["Ninguna", "1 o 2", "3 o más"]),
    parse: (d, text) => {
      const n = countFrom(text);
      if (n === null) return false;
      d.automations = d.project_type === "automation" ? Math.max(1, n) : n;
      return true;
    },
  },
  {
    id: "timeline",
    ask: () => "¿Cuándo te gustaría empezar?",
    options: () => ["Lo antes posible", "En los próximos 1–3 meses", "Sin prisa"],
    parse: (d, text) => {
      if (/antes posible|urgente|ya|inmediat/i.test(text)) d.timeline = "rush";
      else if (/sin prisa|flexible|m[aá]s adelante/i.test(text)) d.timeline = "flexible";
      else if (/mes|pronto|semana/i.test(text)) d.timeline = "standard";
      else return false;
      return true;
    },
  },
  {
    id: "budget",
    ask: () => "Por último, ¿tienes un presupuesto aproximado en mente? Es opcional.",
    options: () => ["Prefiero no decirlo", "Menos de 2.000 €", "2.000–5.000 €", "5.000–10.000 €", "Más de 10.000 €"],
    parse: (d, text) => {
      d.budget = text.trim().slice(0, 80) || "Prefiero no decirlo";
      return true;
    },
  },
];

function nextStepIndex(from: number, d: GuidedData): number {
  for (let i = from; i < STEPS.length; i++) if (!STEPS[i]!.skip?.(d)) return i;
  return STEPS.length;
}

export function toRequirements(d: GuidedData): QuoteRequirements {
  const features = new Set<FeatureKey>(d.features ?? []);
  if (d.admin) features.add("admin_panel");
  if ((d.integrations ?? 0) > 0) features.add("integration");
  if ((d.automations ?? 0) > 0 && d.project_type !== "automation") features.add("automation");
  const featureCount = features.size;
  const complexity = featureCount >= 6 || (d.integrations ?? 0) >= 3 ? "high" : featureCount <= 1 && d.design === "template" ? "low" : "medium";
  const type = d.project_type ?? "web";
  return {
    project_type: type,
    title: d.business ? `${typeLabel(type)} · ${d.business}`.slice(0, 140) : undefined,
    business: d.business,
    pages: d.pages,
    design: d.design ?? "custom",
    features: [...features],
    quantities: {
      integration: d.integrations || undefined,
      automation: d.automations || undefined,
    },
    complexity,
    timeline: d.timeline ?? "standard",
    maintenance: "none",
    notes: [d.goal ? `Objetivo: ${d.goal}` : "", d.has_site !== undefined ? `Web actual: ${d.has_site ? "sí" : "no"}` : "", d.budget ? `Presupuesto indicado: ${d.budget}` : ""]
      .filter(Boolean)
      .join(". "),
  };
}

function typeLabel(t: ProjectType): string {
  return TYPE_OPTIONS.find(([, v]) => v === t)?.[0] ?? "Proyecto";
}

export function guidedStart(): GuidedReply {
  const state: GuidedState = { step: "type", data: {} };
  return { state, text: STEPS[0]!.ask(state.data), options: STEPS[0]!.options(state.data) };
}

export function guidedTurn(prev: GuidedState | null | undefined, text: string, choices: string[] = []): GuidedReply {
  const state: GuidedState = prev?.step ? { step: prev.step, data: { ...prev.data }, quoted: prev.quoted } : { step: "type", data: {} };
  const input = (text || choices.join(", ")).trim();

  if (/^empezar de nuevo$/i.test(input) || /^(reiniciar|reset)$/i.test(input)) {
    const s = guidedStart();
    return { ...s, text: `Empecemos de nuevo. ${s.text}`, restart: true };
  }

  if (state.step === "done") {
    if (/propuesta|^s[ií]\b|contact/i.test(input)) {
      return { state, text: "Estupendo. Revisa tus datos en la tarjeta, acepta la política de privacidad y pulsa «Enviar al equipo». Te escribiremos con una propuesta personalizada.", options: [], contact: true };
    }
    if (/guardar/i.test(input)) {
      return { state, text: "Puedes guardar este presupuesto en tu cuenta con el botón «Guardar» de la tarjeta. Si aún no tienes cuenta, crearla es gratis.", options: [PROPOSAL_LABEL, RESTART_LABEL] };
    }
    return {
      state,
      text: "Estoy funcionando en modo guiado, así que no puedo responder preguntas abiertas. Puedo preparar otra estimación o pasar tu solicitud al equipo, que te responderá personalmente.",
      options: [PROPOSAL_LABEL, RESTART_LABEL],
    };
  }

  const index = Math.max(0, STEPS.findIndex((s) => s.id === state.step));
  const step = STEPS[index]!;
  const ok = step.parse(state.data, input, choices);
  if (!ok) {
    const isQuestion = /\?|¿/.test(input);
    return {
      state,
      text: isQuestion
        ? `Ahora mismo funciono en modo guiado y no puedo responder preguntas abiertas; el equipo lo hará encantado al recibir tu solicitud. Sigamos: ${step.ask(state.data)}`
        : `No te he entendido del todo. ${step.ask(state.data)}`,
      options: step.options(state.data),
      multi: step.multi,
    };
  }

  const next = nextStepIndex(index + 1, state.data);
  const seed = index + (state.data.business?.length ?? 0);
  if (next >= STEPS.length) {
    state.step = "done";
    state.quoted = true;
    return {
      state,
      text: `${pick(seed)} Con lo que me has contado, he preparado una estimación orientativa con nuestras tarifas. ¿Quieres que preparemos una propuesta personalizada para tu proyecto?`,
      options: [PROPOSAL_LABEL, SAVE_LABEL, RESTART_LABEL],
      quote: toRequirements(state.data),
    };
  }
  const nextStep = STEPS[next]!;
  state.step = nextStep.id;
  const lead = index === 0 ? `${pick(seed)} ${typeLabel(state.data.project_type!)}, buena elección.` : pick(seed);
  return { state, text: `${lead} ${nextStep.ask(state.data)}`, options: nextStep.options(state.data), multi: nextStep.multi };
}
