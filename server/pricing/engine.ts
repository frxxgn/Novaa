// Motor de presupuestos orientativos. Función pura: recibe las reglas
// configuradas en el panel y los requisitos validados, y devuelve el desglose.
import {
  FEATURE_LABELS,
  PROJECT_TYPE_LABELS,
  QUANTITY_FEATURES,
  type FeatureKey,
  type QuoteLine,
  type QuoteRequirements,
  type QuoteResult,
} from "../../src/shared/pricing.js";

export interface PricingRule {
  key: string;
  category: "base" | "page" | "feature" | "complexity" | "design" | "timeline" | "maintenance" | "margin" | "discount" | "limit";
  label: string;
  description: string;
  unit: "fixed" | "per_unit" | "multiplier" | "percent" | "monthly";
  min_amount: number;
  max_amount: number;
  value: number;
  applies_to: string[];
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface PricingSettings {
  currency: string;
  vat_note: string;
  rounding: number;
  disclaimer: string;
  reviewed: boolean;
}

export interface PricingReference {
  source_name: string;
  source_url: string;
  retrieved_at: string;
  project_type: string;
  min_amount: number | null;
  max_amount: number | null;
  summary: string;
}

export class PricingConfigError extends Error {}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

function roundTo(value: number, step: number, mode: "floor" | "ceil" | "round" = "round"): number {
  if (step <= 0) return Math.round(value);
  const fn = mode === "floor" ? Math.floor : mode === "ceil" ? Math.ceil : Math.round;
  return fn(value / step) * step;
}

const MAINTENANCE_KEYS = { basic: "maint_basic", pro: "maint_pro", ai: "maint_ai" } as const;
const MAJOR_MODULES: FeatureKey[] = ["admin_panel", "client_portal", "user_accounts", "chatbot_ai", "ecommerce_catalog", "booking", "database_custom"];

export function estimateQuote(
  allRules: PricingRule[],
  settings: PricingSettings,
  req: QuoteRequirements,
  references: PricingReference[] = [],
): QuoteResult {
  const rules = new Map(allRules.filter((r) => r.is_active).map((r) => [r.key, { ...r, min_amount: num(r.min_amount), max_amount: num(r.max_amount), value: num(r.value, 1) }]));
  const items: QuoteLine[] = [];
  const factors: string[] = [];
  const assumptions: string[] = [];

  const base = [...rules.values()].find((r) => r.category === "base" && r.applies_to.includes(req.project_type));
  if (!base) throw new PricingConfigError(`No hay tarifa base activa para el tipo de proyecto «${req.project_type}».`);

  const meta = base.metadata ?? {};
  const includedFeatures = new Set<string>(Array.isArray(meta.includes) ? (meta.includes as string[]) : []);
  const includedUnits = (meta.included_units ?? {}) as Record<string, number>;
  const includedPages = num(meta.included_pages, 0);

  let min = base.min_amount;
  let max = base.max_amount;
  items.push({ kind: "base", rule_key: base.key, label: base.label, detail: base.description, quantity: 1, min: base.min_amount, max: base.max_amount, is_optional: false });

  // Diseño desde plantilla: reduce la base
  if (req.design === "template") {
    const tpl = rules.get("design_template");
    if (tpl && (tpl.applies_to.length === 0 || tpl.applies_to.includes(req.project_type))) {
      const dMin = base.min_amount * (tpl.value - 1);
      const dMax = base.max_amount * (tpl.value - 1);
      min += dMin;
      max += dMax;
      items.push({ kind: "design", rule_key: tpl.key, label: tpl.label, detail: tpl.description, quantity: 1, min: dMin, max: dMax, is_optional: false });
    }
  } else {
    const design = rules.get(req.design === "premium" ? "design_premium" : "design_custom");
    const appliesDesign = ["landing", "web", "ecommerce", "webapp", "redesign", "admin_panel"].includes(req.project_type);
    if (design && appliesDesign) {
      min += design.min_amount;
      max += design.max_amount;
      items.push({ kind: "design", rule_key: design.key, label: design.label, detail: design.description, quantity: 1, min: design.min_amount, max: design.max_amount, is_optional: false });
    }
  }

  // Páginas adicionales
  const pages = req.pages ?? includedPages;
  if (req.pages === undefined && includedPages > 0) assumptions.push(`Se asumen ${includedPages} página${includedPages === 1 ? "" : "s"}, las incluidas en la tarifa base.`);
  const extraPages = Math.max(0, pages - includedPages);
  const pageRule = rules.get("extra_page");
  if (extraPages > 0 && pageRule) {
    const pMin = pageRule.min_amount * extraPages;
    const pMax = pageRule.max_amount * extraPages;
    min += pMin;
    max += pMax;
    items.push({ kind: "page", rule_key: pageRule.key, label: `${pageRule.label} × ${extraPages}`, detail: `${pages} páginas en total, ${includedPages} incluidas`, quantity: extraPages, min: pMin, max: pMax, is_optional: false });
  }

  // Funcionalidades
  const features = [...new Set(req.features)];
  for (const key of features) {
    if (includedFeatures.has(key)) continue;
    const rule = rules.get(key);
    if (!rule || rule.category !== "feature") continue;
    let quantity = 1;
    if ((QUANTITY_FEATURES as readonly string[]).includes(key)) {
      const requested = req.quantities?.[key as (typeof QUANTITY_FEATURES)[number]];
      quantity = requested && requested > 0 ? requested : 1;
      if (!requested) assumptions.push(`${FEATURE_LABELS[key]}: se asume 1 unidad.`);
      quantity = Math.max(0, quantity - num(includedUnits[key], 0));
      if (quantity === 0) continue;
    }
    const fMin = rule.min_amount * quantity;
    const fMax = rule.max_amount * quantity;
    min += fMin;
    max += fMax;
    items.push({ kind: "feature", rule_key: key, label: quantity > 1 ? `${rule.label} × ${quantity}` : rule.label, detail: rule.description, quantity, min: fMin, max: fMax, is_optional: false });
  }
  // Unidades extra de tipos que incluyen una (automatización / integración)
  for (const [key, inc] of Object.entries(includedUnits)) {
    if (features.includes(key as FeatureKey)) continue;
    const requested = req.quantities?.[key as (typeof QUANTITY_FEATURES)[number]] ?? 0;
    const extra = requested - num(inc, 0);
    const rule = rules.get(key);
    if (extra > 0 && rule) {
      min += rule.min_amount * extra;
      max += rule.max_amount * extra;
      items.push({ kind: "feature", rule_key: key, label: `${rule.label} × ${extra}`, detail: `${requested} en total, ${inc} incluida`, quantity: extra, min: rule.min_amount * extra, max: rule.max_amount * extra, is_optional: false });
    }
  }

  // Descuento por proyecto integral
  const discount = rules.get("multi_module_discount");
  if (discount) {
    const modules = features.filter((f) => MAJOR_MODULES.includes(f)).length;
    if (modules >= num(discount.metadata?.min_modules, 3)) {
      const dMin = -min * discount.value;
      const dMax = -max * discount.value;
      min += dMin;
      max += dMax;
      items.push({ kind: "discount", rule_key: discount.key, label: discount.label, detail: `${Math.round(discount.value * 100)} %`, quantity: 1, min: dMin, max: dMax, is_optional: false });
    }
  }

  // Multiplicadores: complejidad y plazo
  for (const [kind, key] of [
    ["complexity", `complexity_${req.complexity}`],
    ["timeline", `timeline_${req.timeline}`],
  ] as const) {
    const rule = rules.get(key);
    if (!rule || rule.value === 1) continue;
    const dMin = min * (rule.value - 1);
    const dMax = max * (rule.value - 1);
    min += dMin;
    max += dMax;
    const pct = Math.round((rule.value - 1) * 100);
    items.push({ kind, rule_key: key, label: rule.label, detail: `${pct > 0 ? "+" : ""}${pct} %`, quantity: 1, min: dMin, max: dMax, is_optional: false });
    factors.push(`${rule.label} (${pct > 0 ? "+" : ""}${pct} %)`);
  }

  // Margen de imprevistos (amplía el máximo)
  const buffer = rules.get("risk_buffer");
  if (buffer && buffer.value > 0) {
    const dMax = max * buffer.value;
    max += dMax;
    items.push({ kind: "margin", rule_key: buffer.key, label: buffer.label, detail: `+${Math.round(buffer.value * 100)} % sobre el máximo`, quantity: 1, min: 0, max: dMax, is_optional: false });
  }

  // Límites y redondeo
  const rounding = Math.max(1, num(settings.rounding, 50));
  const minProject = rules.get("min_project")?.min_amount ?? 0;
  const ratioMin = rules.get("range_ratio_min")?.value ?? 1.1;
  const ratioMax = rules.get("range_ratio_max")?.value ?? 3;

  let totalMin = min;
  let totalMax = max;
  if (req.project_type !== "maintenance") {
    totalMin = Math.max(totalMin, minProject);
    if (totalMax < totalMin * ratioMin) totalMax = totalMin * ratioMin;
    if (totalMax > totalMin * ratioMax) totalMax = totalMin * ratioMax;
  }
  totalMin = roundTo(Math.max(0, totalMin), rounding, "floor");
  totalMax = roundTo(Math.max(totalMin, totalMax), rounding, "ceil");

  // Mantenimiento mensual
  let monthlyMin = 0;
  let monthlyMax = 0;
  if (req.maintenance !== "none") {
    const rule = rules.get(MAINTENANCE_KEYS[req.maintenance]);
    if (rule) {
      monthlyMin = rule.min_amount;
      monthlyMax = rule.max_amount;
      items.push({ kind: "maintenance", rule_key: rule.key, label: `${rule.label} (mensual)`, detail: rule.description, quantity: 1, min: monthlyMin, max: monthlyMax, is_optional: false });
    }
  } else if (req.project_type === "maintenance") {
    const rule = rules.get("maint_basic");
    if (rule) {
      monthlyMin = rule.min_amount;
      monthlyMax = rule.max_amount;
      assumptions.push("Se toma como referencia el plan de mantenimiento básico.");
    }
  }

  // Opcionales sugeridos
  const optional = [...rules.values()]
    .filter((r) => r.category === "feature")
    .filter((r) => Array.isArray(r.metadata?.suggest_for) && (r.metadata.suggest_for as string[]).includes(req.project_type))
    .filter((r) => !features.includes(r.key as FeatureKey) && !includedFeatures.has(r.key))
    .slice(0, 4)
    .map((r) => ({ key: r.key, label: r.label, min: r.min_amount, max: r.max_amount }));

  if (req.maintenance === "none" && req.project_type !== "maintenance") {
    const m = rules.get("maint_basic");
    if (m) optional.push({ key: m.key, label: `${m.label} (mensual)`, min: m.min_amount, max: m.max_amount });
  }

  // Factores que pueden modificar el precio
  factors.push(
    "Número final de páginas y volumen de contenidos",
    "Nivel de personalización del diseño y de las animaciones",
    "Integraciones con sistemas de terceros y su documentación",
    "Plazo de entrega y disponibilidad de los contenidos",
  );

  const included = Array.isArray(meta.included_text) ? (meta.included_text as string[]) : [];
  for (const key of features) {
    if (!includedFeatures.has(key) && rules.has(key)) included.push(FEATURE_LABELS[key]);
  }

  const refs = references
    .filter((r) => r.project_type === req.project_type)
    .map((r) => ({ source: r.source_name, url: r.source_url, retrieved_at: r.retrieved_at, min: r.min_amount, max: r.max_amount, summary: r.summary }));

  return {
    project_type: req.project_type,
    project_label: PROJECT_TYPE_LABELS[req.project_type],
    title: req.title?.trim() || PROJECT_TYPE_LABELS[req.project_type],
    currency: settings.currency || "EUR",
    total_min: totalMin,
    total_max: totalMax,
    monthly_min: monthlyMin,
    monthly_max: monthlyMax,
    items: items.map((i) => ({ ...i, min: Math.round(i.min), max: Math.round(i.max) })),
    factors,
    included: [...new Set(included)],
    optional,
    assumptions,
    disclaimer: settings.disclaimer,
    vat_note: settings.vat_note,
    references: refs,
    reviewed: Boolean(settings.reviewed),
  };
}
