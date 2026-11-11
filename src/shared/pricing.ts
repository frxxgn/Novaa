// Tipos y etiquetas compartidos entre cliente y servidor para el motor de
// presupuestos (sin dependencias). El CÁLCULO solo se realiza en el servidor.

export const PROJECT_TYPES = [
  "landing",
  "web",
  "ecommerce",
  "webapp",
  "redesign",
  "ai_assistant",
  "automation",
  "admin_panel",
  "database",
  "integration",
  "seo",
  "maintenance",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  landing: "Landing page",
  web: "Web corporativa",
  ecommerce: "Tienda online",
  webapp: "Aplicación web a medida",
  redesign: "Rediseño web",
  ai_assistant: "Asistente o chatbot con IA",
  automation: "Automatización con IA",
  admin_panel: "Panel administrativo",
  database: "Base de datos y gestión",
  integration: "Integración entre plataformas",
  seo: "SEO y posicionamiento",
  maintenance: "Mantenimiento",
};

export const FEATURE_KEYS = [
  "contact_forms",
  "blog_cms",
  "multilingual",
  "booking",
  "payments",
  "ecommerce_catalog",
  "user_accounts",
  "client_portal",
  "admin_panel",
  "database_custom",
  "integration",
  "automation",
  "chatbot_ai",
  "seo_setup",
  "analytics_setup",
  "copywriting",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  contact_forms: "Formularios de contacto",
  blog_cms: "Blog o gestor de contenidos",
  multilingual: "Idiomas adicionales",
  booking: "Reservas o citas online",
  payments: "Pagos online",
  ecommerce_catalog: "Catálogo de productos",
  user_accounts: "Cuentas de usuario",
  client_portal: "Portal de clientes",
  admin_panel: "Panel administrativo",
  database_custom: "Base de datos a medida",
  integration: "Integraciones",
  automation: "Automatizaciones",
  chatbot_ai: "Asistente con IA",
  seo_setup: "SEO inicial avanzado",
  analytics_setup: "Analíticas y medición",
  copywriting: "Redacción de contenidos",
};

/** Funcionalidades que admiten cantidad (por unidad). */
export const QUANTITY_FEATURES = ["multilingual", "integration", "automation", "copywriting"] as const;

export const DESIGN_LEVELS = ["template", "custom", "premium"] as const;
export const COMPLEXITY_LEVELS = ["low", "medium", "high"] as const;
export const TIMELINES = ["flexible", "standard", "rush"] as const;
export const MAINTENANCE_PLANS = ["none", "basic", "pro", "ai"] as const;

/** Requisitos de un presupuesto (validados en servidor con pricing-schema.ts). */
export interface QuoteRequirements {
  project_type: ProjectType;
  title?: string;
  business?: string;
  pages?: number;
  design: (typeof DESIGN_LEVELS)[number];
  features: FeatureKey[];
  quantities: { multilingual?: number; integration?: number; automation?: number; copywriting?: number };
  complexity: (typeof COMPLEXITY_LEVELS)[number];
  timeline: (typeof TIMELINES)[number];
  maintenance: (typeof MAINTENANCE_PLANS)[number];
  notes?: string;
}

export interface QuoteLine {
  kind: "base" | "page" | "feature" | "design" | "complexity" | "timeline" | "maintenance" | "margin" | "discount" | "optional";
  rule_key: string;
  label: string;
  detail: string;
  quantity: number;
  min: number;
  max: number;
  is_optional: boolean;
}

export interface QuoteResult {
  project_type: ProjectType;
  project_label: string;
  title: string;
  currency: string;
  total_min: number;
  total_max: number;
  monthly_min: number;
  monthly_max: number;
  items: QuoteLine[];
  factors: string[];
  included: string[];
  optional: { key: string; label: string; min: number; max: number }[];
  assumptions: string[];
  disclaimer: string;
  vat_note: string;
  references: { source: string; url: string; retrieved_at: string; min: number | null; max: number | null; summary: string }[];
  reviewed: boolean;
}

export interface QuoteSummary extends QuoteResult {
  id: string;
  reference: string;
  claim_token?: string;
  created_at: string;
  valid_until: string | null;
}

export function formatEUR(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
