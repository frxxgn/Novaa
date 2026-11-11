import { describe, expect, it } from "vitest";
import { quoteRequirementsSchema } from "../../src/shared/pricing-schema.js";
import { estimateQuote, PricingConfigError, type PricingRule } from "../../server/pricing/engine.js";

const rule = (r: Partial<PricingRule> & Pick<PricingRule, "key" | "category" | "unit">): PricingRule => ({
  label: r.key,
  description: "",
  min_amount: 0,
  max_amount: 0,
  value: 1,
  applies_to: [],
  is_active: true,
  metadata: {},
  ...r,
});

const RULES: PricingRule[] = [
  rule({ key: "base_web", category: "base", unit: "fixed", min_amount: 1000, max_amount: 2000, applies_to: ["web"], metadata: { included_pages: 5, includes: ["contact_forms"], included_text: ["Diseño responsive"] } }),
  rule({ key: "base_automation", category: "base", unit: "fixed", min_amount: 800, max_amount: 1600, applies_to: ["automation"], metadata: { included_units: { automation: 1 } } }),
  rule({ key: "extra_page", category: "page", unit: "per_unit", min_amount: 100, max_amount: 200 }),
  rule({ key: "design_custom", category: "design", unit: "fixed", min_amount: 500, max_amount: 1000 }),
  rule({ key: "design_template", category: "design", unit: "multiplier", value: 0.8, applies_to: ["web"] }),
  rule({ key: "contact_forms", category: "feature", unit: "fixed", min_amount: 100, max_amount: 200 }),
  rule({ key: "booking", category: "feature", unit: "fixed", min_amount: 400, max_amount: 800, metadata: { suggest_for: [] } }),
  rule({ key: "automation", category: "feature", unit: "per_unit", min_amount: 300, max_amount: 600 }),
  rule({ key: "seo_setup", category: "feature", unit: "fixed", min_amount: 300, max_amount: 600, metadata: { suggest_for: ["web"] } }),
  rule({ key: "complexity_high", category: "complexity", unit: "multiplier", value: 1.5 }),
  rule({ key: "timeline_rush", category: "timeline", unit: "multiplier", value: 1.2 }),
  rule({ key: "maint_basic", category: "maintenance", unit: "monthly", min_amount: 50, max_amount: 90 }),
  rule({ key: "risk_buffer", category: "margin", unit: "percent", value: 0.1 }),
  rule({ key: "min_project", category: "limit", unit: "fixed", min_amount: 600, max_amount: 600 }),
  rule({ key: "range_ratio_min", category: "limit", unit: "multiplier", value: 1.15 }),
  rule({ key: "range_ratio_max", category: "limit", unit: "multiplier", value: 3 }),
];
const SETTINGS = { currency: "EUR", vat_note: "Sin IVA", rounding: 50, disclaimer: "Orientativo", reviewed: true };
const req = (input: unknown) => quoteRequirementsSchema.parse(input);

describe("motor de presupuestos", () => {
  it("calcula base + diseño + funcionalidades y redondea", () => {
    const q = estimateQuote(RULES, SETTINGS, req({ project_type: "web", features: ["booking"] }));
    // 1000 + 500 + 400 = 1900 ; max (2000+1000+800)=3800 *1.1 = 4180 -> 4200
    expect(q.total_min).toBe(1900);
    expect(q.total_max).toBe(4200);
    expect(q.items.map((i) => i.rule_key)).toEqual(["base_web", "design_custom", "booking", "risk_buffer"]);
    expect(q.disclaimer).toBe("Orientativo");
  });

  it("no cobra funcionalidades incluidas en la base", () => {
    const q = estimateQuote(RULES, SETTINGS, req({ project_type: "web", features: ["contact_forms"] }));
    expect(q.items.some((i) => i.rule_key === "contact_forms")).toBe(false);
  });

  it("cobra páginas adicionales por encima de las incluidas", () => {
    const q = estimateQuote(RULES, SETTINGS, req({ project_type: "web", pages: 8, features: [] }));
    const pages = q.items.find((i) => i.rule_key === "extra_page");
    expect(pages?.quantity).toBe(3);
    expect(pages?.min).toBe(300);
  });

  it("aplica plantilla como multiplicador sobre la base", () => {
    const q = estimateQuote(RULES, SETTINGS, req({ project_type: "web", design: "template", features: [] }));
    expect(q.items.find((i) => i.rule_key === "design_template")?.min).toBe(-200);
    expect(q.total_min).toBe(800);
  });

  it("aplica complejidad y plazo como multiplicadores", () => {
    const base = estimateQuote(RULES, SETTINGS, req({ project_type: "web", features: [] }));
    const hard = estimateQuote(RULES, SETTINGS, req({ project_type: "web", features: [], complexity: "high", timeline: "rush" }));
    expect(hard.total_min).toBeGreaterThan(base.total_min * 1.7);
    expect(hard.factors.length).toBeGreaterThan(base.factors.length);
  });

  it("descuenta unidades incluidas (automatización)", () => {
    const one = estimateQuote(RULES, SETTINGS, req({ project_type: "automation", features: ["automation"], quantities: { automation: 1 } }));
    const three = estimateQuote(RULES, SETTINGS, req({ project_type: "automation", features: ["automation"], quantities: { automation: 3 } }));
    expect(one.items.some((i) => i.rule_key === "automation")).toBe(false);
    expect(three.items.find((i) => i.rule_key === "automation")?.quantity).toBe(2);
  });

  it("separa el mantenimiento mensual y sugiere opcionales", () => {
    const q = estimateQuote(RULES, SETTINGS, req({ project_type: "web", features: [], maintenance: "basic" }));
    expect(q.monthly_min).toBe(50);
    expect(q.monthly_max).toBe(90);
    const q2 = estimateQuote(RULES, SETTINGS, req({ project_type: "web", features: [] }));
    expect(q2.optional.map((o) => o.key)).toContain("seo_setup");
    expect(q2.optional.map((o) => o.key)).toContain("maint_basic");
  });

  it("respeta el importe mínimo y la amplitud mínima del rango", () => {
    const cheap = [...RULES.filter((r) => r.key !== "base_web"), rule({ key: "base_web", category: "base", unit: "fixed", min_amount: 100, max_amount: 100, applies_to: ["web"] })];
    const q = estimateQuote(cheap, SETTINGS, req({ project_type: "web", design: "template", features: [] }));
    expect(q.total_min).toBeGreaterThanOrEqual(600);
    expect(q.total_max).toBeGreaterThanOrEqual(q.total_min * 1.15);
  });

  it("ignora reglas inactivas y falla si no hay tarifa base", () => {
    const inactive = RULES.map((r) => (r.key === "base_web" ? { ...r, is_active: false } : r));
    expect(() => estimateQuote(inactive, SETTINGS, req({ project_type: "web", features: [] }))).toThrow(PricingConfigError);
  });

  it("solo usa referencias de mercado del mismo tipo y conserva la procedencia", () => {
    const q = estimateQuote(RULES, SETTINGS, req({ project_type: "web", features: [] }), [
      { source_name: "Fuente A", source_url: "https://example.com", retrieved_at: "2026-10-01", project_type: "web", min_amount: 1, max_amount: 2, summary: "" },
      { source_name: "Fuente B", source_url: "", retrieved_at: "2026-10-01", project_type: "ecommerce", min_amount: 1, max_amount: 2, summary: "" },
    ]);
    expect(q.references).toHaveLength(1);
    expect(q.references[0]?.source).toBe("Fuente A");
    expect(q.references[0]?.retrieved_at).toBe("2026-10-01");
  });

  it("valida los requisitos de entrada", () => {
    expect(quoteRequirementsSchema.safeParse({ project_type: "otro", features: [] }).success).toBe(false);
    expect(quoteRequirementsSchema.safeParse({ project_type: "web", features: ["hackear"] }).success).toBe(false);
    expect(quoteRequirementsSchema.safeParse({ project_type: "web", pages: -1 }).success).toBe(false);
  });
});
