// Rutas públicas: formulario de contacto, presupuestos, analíticas y sitemap.
import { Hono } from "hono";
import { z } from "zod";
import { quoteRequirementsSchema } from "../../src/shared/pricing-schema.js";
import { env, integrations } from "../env.js";
import { ApiError, forbidden, ipHash, notFound, readJson, tooMany } from "../lib/http.js";
import { admin, getAuth, getSetting, rateLimit, requireAuth } from "../lib/supabase.js";
import { createLead, leadInputSchema } from "../leads/service.js";
import { createQuote, verifyQuoteToken } from "../quotes/service.js";
import { PricingConfigError } from "../pricing/engine.js";

export const pub = new Hono();

const SECURITY_DEFAULTS = { leads_per_hour: 6, quotes_per_hour: 20, analytics_per_minute: 90 };

pub.get("/health", async (c) => {
  let database = false;
  if (integrations.supabase) {
    const { error } = await admin().from("site_settings").select("key", { head: true, count: "exact" }).limit(1);
    database = !error;
  }
  return c.json({
    ok: database,
    time: new Date().toISOString(),
    integrations: {
      database,
      auth: integrations.supabase,
      ai: integrations.ai,
      email: integrations.email,
      email_provider: integrations.email ? env.emailProvider : null,
      whatsapp: integrations.whatsapp,
    },
  });
});

// ---------------------------------------------------------------------------
// Formulario de contacto / solicitud de propuesta
// ---------------------------------------------------------------------------
const contactSchema = leadInputSchema.extend({
  source: z.enum(["contact_form", "template", "quote", "challenge"]).default("contact_form"),
  source_detail: z.string().max(200).optional(),
  quote_id: z.uuid().optional(),
  quote_token: z.string().max(100).optional(),
  website: z.string().max(200).optional(), // honeypot: debe llegar vacío
  utm: z.record(z.string(), z.string().max(120)).optional(),
  started_at: z.number().optional(), // marca del formulario para detectar envíos automáticos
});

pub.post("/leads", async (c) => {
  const body = await readJson(c, contactSchema);
  if (body.website) return c.json({ ok: true }); // bot: se descarta en silencio
  if (body.started_at && Date.now() - body.started_at < 1500) return c.json({ ok: true });
  const security = await getSetting("security", SECURITY_DEFAULTS);
  if (!(await rateLimit(`lead:${ipHash(c)}`, Number(security.leads_per_hour) || 6, 3600))) throw tooMany();

  const auth = await getAuth(c);
  let quoteId: string | null = null;
  if (body.quote_id) {
    const { data: q } = await admin().from("quotes").select("id, user_id").eq("id", body.quote_id).maybeSingle();
    const owned = q && auth && q.user_id === auth.user.id;
    if (q && (owned || (await verifyQuoteToken(q.id, body.quote_token)))) quoteId = q.id;
  }
  const lead = await createLead(body, {
    source: quoteId ? "quote" : body.source,
    sourceDetail: body.source_detail,
    quoteId,
    userId: auth?.user.id ?? null,
    utm: body.utm,
  });
  return c.json({ ok: true, lead_id: lead.id });
});

// ---------------------------------------------------------------------------
// Presupuestos
// ---------------------------------------------------------------------------
pub.post("/quotes/estimate", async (c) => {
  const body = await readJson(c, quoteRequirementsSchema);
  const security = await getSetting("security", SECURITY_DEFAULTS);
  if (!(await rateLimit(`quote:${ipHash(c)}`, Number(security.quotes_per_hour) || 20, 3600))) throw tooMany();
  const auth = await getAuth(c);
  try {
    const quote = await createQuote(body, { userId: auth?.user.id ?? null, source: "form" });
    return c.json({ quote });
  } catch (e) {
    if (e instanceof PricingConfigError) throw new ApiError(422, "pricing_not_configured", e.message);
    throw e;
  }
});

pub.post("/quotes/:id/claim", async (c) => {
  const auth = await requireAuth(c);
  const body = await readJson(c, z.object({ token: z.string().min(10).max(100) }));
  const id = c.req.param("id");
  if (!z.uuid().safeParse(id).success) throw notFound();
  const { data: q } = await admin().from("quotes").select("id, user_id, status").eq("id", id).maybeSingle();
  if (!q) throw notFound("Presupuesto no encontrado.");
  if (q.user_id && q.user_id !== auth.user.id) throw forbidden();
  if (!q.user_id && !(await verifyQuoteToken(id, body.token))) throw forbidden("El enlace del presupuesto no es válido.");
  await admin()
    .from("quotes")
    .update({ user_id: auth.user.id, claim_hash: null, ...(q.status === "estimate" ? { status: "saved" } : {}) })
    .eq("id", id);
  return c.json({ ok: true });
});

// Solicitar propuesta desde la cuenta (usa los datos del perfil)
pub.post("/quotes/:id/request-proposal", async (c) => {
  const auth = await requireAuth(c);
  const body = await readJson(c, z.object({ message: z.string().max(2000).optional(), phone: z.string().max(40).optional(), consent: z.literal(true) }));
  const id = c.req.param("id");
  const { data: q } = await admin().from("quotes").select("id, user_id, lead_id, project_type, title").eq("id", id).maybeSingle();
  if (!q || q.user_id !== auth.user.id) throw notFound("Presupuesto no encontrado.");
  if (q.lead_id) return c.json({ ok: true, lead_id: q.lead_id, already: true });
  const { data: profile } = await admin().from("profiles").select("full_name, email, phone, company").eq("id", auth.user.id).single();
  const lead = await createLead(
    {
      name: profile?.full_name || (profile?.email ?? "").split("@")[0] || "Cliente",
      email: profile?.email ?? auth.user.email ?? "",
      phone: body.phone || profile?.phone || "",
      company: profile?.company ?? "",
      project_type: q.project_type,
      message: body.message || `Solicitud de propuesta para «${q.title}».`,
      budget_range: "",
      timeline: "",
      whatsapp_opt_in: false,
      consent: true,
    },
    { source: "quote", sourceDetail: "Cuenta de usuario", quoteId: q.id, userId: auth.user.id },
  );
  return c.json({ ok: true, lead_id: lead.id });
});

// ---------------------------------------------------------------------------
// Analíticas propias (solo con consentimiento; sin IP ni cookies)
// ---------------------------------------------------------------------------
const eventSchema = z.object({
  name: z.enum(["page_view", "cta_click", "nova_open", "nova_message", "quote_view", "form_submit", "template_open", "game_start", "outbound_click"]),
  path: z.string().max(300).default(""),
  session_id: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
  props: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
  referrer: z.string().max(300).optional(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional(),
});

pub.post("/analytics", async (c) => {
  const cfg = await getSetting("analytics", { enabled: true });
  if (!cfg.enabled) return c.body(null, 204);
  const security = await getSetting("security", SECURITY_DEFAULTS);
  const body = await readJson(c, z.union([eventSchema, z.array(eventSchema).max(20)]), 16 * 1024);
  if (!(await rateLimit(`analytics:${ipHash(c)}`, Number(security.analytics_per_minute) || 90, 60))) return c.body(null, 204);
  const auth = await getAuth(c);
  const events = (Array.isArray(body) ? body : [body]).map((e) => {
    let referrer = "";
    try {
      if (e.referrer) {
        const host = new URL(e.referrer).hostname;
        if (host && !env.siteUrl.includes(host)) referrer = host;
      }
    } catch {
      /* referrer no válido: se ignora */
    }
    return { name: e.name, path: e.path.split("?")[0]!.slice(0, 300), session_id: e.session_id, user_id: auth?.user.id ?? null, props: e.props ?? {}, referrer, device: e.device ?? "" };
  });
  await admin().from("analytics_events").insert(events);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Sitemap dinámico (páginas publicadas, servicios, proyectos y plantillas)
// ---------------------------------------------------------------------------
/** Dominio público: ajuste SEO del panel → SITE_URL → origen de la petición. */
async function publicBase(requestUrl: string): Promise<string> {
  const seo = await getSetting("seo_defaults", { site_url: "" });
  const configured = String(seo.site_url || (env.siteUrlConfigured ? env.siteUrl : ""));
  return (configured || new URL(requestUrl).origin).replace(/\/$/, "");
}

pub.get("/robots", async (c) => {
  const base = await publicBase(c.req.url);
  const status = await getSetting("site_status", { indexable: true } as { indexable?: boolean });
  const rules =
    status.indexable === false
      ? ["User-agent: *", "Disallow: /"]
      : ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /cuenta", "Disallow: /api/", "Disallow: /__preview", "Disallow: /demo/", "Disallow: /auth/"];
  return c.body(`${rules.join("\n")}\n\nSitemap: ${base}/sitemap.xml\n`, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
});

pub.get("/sitemap", async (c) => {
  const base = await publicBase(c.req.url);
  const db = admin();
  const [{ data: pages }, { data: services }, { data: projects }, { data: templates }] = await Promise.all([
    db.from("pages").select("path, updated_at, seo, published_version_id").not("published_version_id", "is", null),
    db.from("services").select("slug, updated_at").eq("is_published", true),
    db.from("projects").select("slug, updated_at").eq("is_published", true),
    db.from("templates").select("slug, updated_at").eq("is_published", true),
  ]);
  const urls: { loc: string; lastmod: string }[] = [];
  for (const p of pages ?? []) if (!(p.seo as { noindex?: boolean })?.noindex) urls.push({ loc: `${base}${p.path === "/" ? "/" : p.path}`, lastmod: p.updated_at });
  for (const s of services ?? []) urls.push({ loc: `${base}/servicios/${s.slug}`, lastmod: s.updated_at });
  for (const p of projects ?? []) urls.push({ loc: `${base}/proyectos/${p.slug}`, lastmod: p.updated_at });
  for (const t of templates ?? []) urls.push({ loc: `${base}/plantillas/${t.slug}`, lastmod: t.updated_at });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc.replace(/&/g, "&amp;")}</loc><lastmod>${u.lastmod.slice(0, 10)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  return c.body(xml, 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
});
