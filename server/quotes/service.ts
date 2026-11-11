// Servicio de presupuestos: carga reglas, calcula en servidor y persiste.
import { randomInt } from "node:crypto";
import type { QuoteRequirements, QuoteResult, QuoteSummary } from "../../src/shared/pricing.js";
import { admin, getSetting } from "../lib/supabase.js";
import { randomToken, sha256 } from "../lib/http.js";
import { estimateQuote, type PricingReference, type PricingRule, type PricingSettings } from "../pricing/engine.js";

const PRICING_DEFAULTS: PricingSettings & Record<string, unknown> = {
  currency: "EUR",
  vat_note: "Importes sin IVA.",
  rounding: 50,
  disclaimer: "Estimación orientativa. No constituye un presupuesto definitivo.",
  reviewed: false,
  valid_days: 30,
};

let rulesCache: { at: number; rules: PricingRule[]; refs: PricingReference[] } | null = null;

export async function loadPricing() {
  if (rulesCache && Date.now() - rulesCache.at < 20_000) return rulesCache;
  const db = admin();
  const [{ data: rules, error }, { data: refs }] = await Promise.all([
    db.from("pricing_rules").select("key, category, label, description, unit, min_amount, max_amount, value, applies_to, is_active, metadata").order("position"),
    db.from("pricing_references").select("source_name, source_url, retrieved_at, project_type, min_amount, max_amount, summary").eq("is_active", true),
  ]);
  if (error) throw error;
  rulesCache = { at: Date.now(), rules: (rules ?? []) as PricingRule[], refs: (refs ?? []) as PricingReference[] };
  return rulesCache;
}

export function invalidatePricingCache() {
  rulesCache = null;
}

export async function calculate(req: QuoteRequirements): Promise<QuoteResult> {
  const [{ rules, refs }, settings] = await Promise.all([loadPricing(), getSetting("pricing", PRICING_DEFAULTS)]);
  return estimateQuote(rules, settings, req, refs);
}

function quoteReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[randomInt(alphabet.length)];
  const d = new Date();
  return `NV-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${s}`;
}

export interface CreateQuoteOptions {
  userId?: string | null;
  conversationId?: string | null;
  source: "nova" | "form" | "admin";
}

/** Calcula y guarda el presupuesto. Si no hay usuario, devuelve un token para reclamarlo después. */
export async function createQuote(req: QuoteRequirements, opts: CreateQuoteOptions): Promise<QuoteSummary> {
  const result = await calculate(req);
  const settings = await getSetting("pricing", PRICING_DEFAULTS);
  const validDays = Number(settings.valid_days) || 30;
  const validUntil = new Date(Date.now() + validDays * 86_400_000).toISOString().slice(0, 10);
  const claimToken = opts.userId ? undefined : randomToken(18);
  const { rules } = await loadPricing();

  const db = admin();
  const { data: quote, error } = await db
    .from("quotes")
    .insert({
      reference: quoteReference(),
      user_id: opts.userId ?? null,
      claim_hash: claimToken ? sha256(claimToken) : null,
      conversation_id: opts.conversationId ?? null,
      status: opts.userId ? "saved" : "estimate",
      project_type: result.project_type,
      title: result.title,
      requirements: req,
      total_min: result.total_min,
      total_max: result.total_max,
      monthly_min: result.monthly_min,
      monthly_max: result.monthly_max,
      currency: result.currency,
      factors: result.factors,
      included: result.included,
      optional: result.optional,
      disclaimer: result.disclaimer,
      references_used: result.references,
      rules_snapshot: { rules: rules.filter((r) => r.is_active).map((r) => ({ key: r.key, min: r.min_amount, max: r.max_amount, value: r.value })), reviewed: result.reviewed, assumptions: result.assumptions },
      source: opts.source,
      valid_until: validUntil,
    })
    .select("id, reference, created_at, valid_until")
    .single();
  if (error || !quote) throw error ?? new Error("No se pudo guardar el presupuesto");

  if (result.items.length) {
    const { error: itemsError } = await db.from("quote_items").insert(
      result.items.map((item, position) => ({
        quote_id: quote.id,
        kind: item.kind,
        rule_key: item.rule_key,
        label: item.label,
        detail: item.detail,
        quantity: item.quantity,
        min_amount: item.min,
        max_amount: item.max,
        is_optional: item.is_optional,
        position,
      })),
    );
    if (itemsError) console.error("[quotes] items", itemsError.message);
  }

  if (opts.conversationId) {
    await db.from("conversations").update({ quote_id: quote.id }).eq("id", opts.conversationId);
  }

  return { ...result, id: quote.id, reference: quote.reference, claim_token: claimToken, created_at: quote.created_at, valid_until: quote.valid_until };
}

/** Comprueba el token de un presupuesto anónimo. */
export async function verifyQuoteToken(quoteId: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const { data } = await admin().from("quotes").select("claim_hash").eq("id", quoteId).maybeSingle();
  return Boolean(data?.claim_hash && data.claim_hash === sha256(token));
}
