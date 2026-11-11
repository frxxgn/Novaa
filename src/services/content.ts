// Capa de acceso a datos públicos del CMS (Supabase + RLS).
import { supabase } from "@/lib/supabase";
import { normalizeAnimations, normalizeTokens } from "@/lib/design";
import type { Faq, NavItem, Project, PublishedPage, Service, SiteSettings, Template } from "@/types/content";

export const DEFAULT_SETTINGS: SiteSettings = {
  company: { name: "Novalius", legal_name: "", tax_id: "", address: "", tagline: "Creamos experiencias digitales que impulsan negocios", description: "" },
  contact: { email: "webnovalius@gmail.com", phone: "", whatsapp: "", whatsapp_message: "", hours: "" },
  social: {},
  branding: { logo_dark_bg: "", logo_light_bg: "", mark: "", favicon: "/favicon.svg", nova_avatar: "" },
  seo_defaults: { site_url: "", title_template: "%s · Novalius", default_title: "Novalius", description: "", og_image: "/og-image.jpg", twitter_handle: "" },
  locales: { default: "es", enabled: ["es"], available: ["es", "en"] },
  cookies: { version: "2026-11", banner_title: "Tu privacidad", banner_text: "" },
  privacy: { consent_version: "2026-11", conversation_retention_days: 365, analytics_retention_days: 395, lead_retention_note: "" },
  site_status: { maintenance: false, message: "" },
  analytics: { enabled: true },
  challenge: { enabled: true, quiz_questions: 10, quiz_duration_seconds: 60, coupon_percent: 5, coupon_valid_days: 90, coupon_conditions: "", ttt_levels: {}, ttt_reward_levels: [] },
};

export async function fetchSiteBundle() {
  const [settings, design, nav, translations] = await Promise.all([
    supabase.from("site_settings").select("key, value").eq("is_public", true),
    supabase.from("design_settings").select("tokens, animations, published_at").eq("status", "published").maybeSingle(),
    supabase.from("navigation_items").select("*").eq("is_visible", true).order("position"),
    supabase.from("translations").select("key, locale, value"),
  ]);
  if (settings.error) throw settings.error;
  const merged = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
  for (const row of settings.data ?? []) {
    merged[row.key] = { ...(merged[row.key] ?? {}), ...(row.value as Record<string, unknown>) };
  }
  return {
    settings: merged as unknown as SiteSettings,
    tokens: normalizeTokens(design.data?.tokens),
    animations: normalizeAnimations(design.data?.animations),
    nav: (nav.data ?? []) as NavItem[],
    translations: (translations.data ?? []) as { key: string; locale: string; value: string }[],
  };
}

export async function fetchPublishedPage(path: string): Promise<PublishedPage | null> {
  const { data, error } = await supabase.rpc("get_published_page", { p_path: path });
  if (error) throw error;
  return (data as PublishedPage | null) ?? null;
}

export async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase.from("services").select("*").eq("is_published", true).order("position");
  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function fetchService(slug: string): Promise<{ service: Service; faqs: Faq[] } | null> {
  const { data, error } = await supabase.from("services").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: faqs } = await supabase.from("faqs").select("*").eq("service_id", data.id).eq("is_published", true).order("position");
  return { service: data as Service, faqs: (faqs ?? []) as Faq[] };
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("*").eq("is_published", true).order("position");
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function fetchProject(slug: string): Promise<Project | null> {
  const { data, error } = await supabase.from("projects").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  return (data as Project | null) ?? null;
}

export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase.from("templates").select("*").eq("is_published", true).order("position");
  if (error) throw error;
  return (data ?? []) as Template[];
}

export async function fetchTemplate(slug: string): Promise<Template | null> {
  const { data, error } = await supabase.from("templates").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  return (data as Template | null) ?? null;
}

export async function fetchFaqs(scope: string): Promise<Faq[]> {
  const { data, error } = await supabase.from("faqs").select("*").eq("scope", scope).eq("is_published", true).order("position");
  if (error) throw error;
  return (data ?? []) as Faq[];
}

export interface NovaPublicConfig {
  name: string;
  avatar_url: string;
  welcome_message: string;
  starter_questions: string[];
  ai_disclosure: string;
  enabled: boolean;
  mode: "ai" | "guided";
  whatsapp: { number: string; message: string } | null;
  email: string | null;
}
