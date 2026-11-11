// Tipos de contenido del CMS (forma de las filas en Supabase).

export type I18n = Record<string, Record<string, string>>;

export interface SeoMeta {
  title?: string;
  description?: string;
  og_image?: string;
  canonical?: string;
  noindex?: boolean;
}

export interface NavItem {
  id: string;
  menu: "header" | "footer" | "legal" | "social";
  label: string;
  href: string;
  group_label: string;
  position: number;
  is_visible: boolean;
  is_cta: boolean;
  i18n: I18n;
}

export interface SectionData {
  id: string;
  type: string;
  label: string;
  props: Record<string, unknown>;
  style: { tone?: "dark" | "light" | "violet"; spacing?: "compact" | "normal" | "spacious"; align?: "left" | "center" } & Record<string, unknown>;
  is_visible: boolean;
}

export interface PageSnapshot {
  title: string;
  path: string;
  kind: string;
  seo: SeoMeta;
  i18n: I18n;
  sections: SectionData[];
}

export interface PublishedPage {
  id: string;
  version: number;
  published_at: string;
  page: PageSnapshot;
}

export interface Service {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  problem: string;
  benefits: string[];
  features: { title: string; description: string }[];
  examples: string[];
  icon: string;
  visual: string;
  accent: string;
  cta_label: string;
  project_type: string;
  seo: SeoMeta;
  i18n: I18n;
  position: number;
  is_published: boolean;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  client_label: string;
  is_concept: boolean;
  category: string;
  summary: string;
  challenge: string;
  solution: string;
  outcome: string;
  features: string[];
  stack: string[];
  cover_url: string;
  gallery: { url: string; alt: string; kind?: "image" | "video" }[];
  video_url: string;
  demo_url: string;
  accent: string;
  year: number | null;
  seo: SeoMeta;
  i18n: I18n;
  position: number;
  is_published: boolean;
}

export interface TemplateTheme {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  font: "serif" | "sans" | "condensed" | "display";
  layout: "editorial" | "split" | "centered";
}

export interface TemplateContent {
  brand: string;
  tagline: string;
  hero: { title: string; subtitle: string; cta: string };
  nav: string[];
  offer_title: string;
  categories: { name: string; items: { name: string; description: string; price: string }[] }[];
  features: { title: string; text: string }[];
  booking: { title: string; cta: string; kind: "table" | "appointment" | "quote" | "contact"; options?: string[] };
  hours: string[];
  contact: { address: string; phone: string };
  faq?: { q: string; a: string }[];
  status_demo?: { plate: string; steps: string[]; current: number };
}

export interface Template {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  demo_key: string;
  theme: TemplateTheme;
  content: TemplateContent;
  screenshots: { url: string; alt: string }[];
  i18n: I18n;
  position: number;
  is_published: boolean;
}

export interface Faq {
  id: string;
  scope: "general" | "service" | "challenge" | "account";
  service_id: string | null;
  question: string;
  answer: string;
  i18n: I18n;
  position: number;
  is_published: boolean;
}

export interface DesignTokens {
  colors: Record<string, string>;
  typography: { display: string; body: string; mono: string; scale: number; display_weight: number; display_tracking: number };
  radius: { sm: number; md: number; lg: number };
  spacing: { section: number; container: number; gutter: number };
  effects: { glow: number; shadow: number; glass_opacity: number; glass_blur: number; border_opacity: number; noise: number };
  buttons: { shape: "pill" | "rounded" | "square"; magnetic: boolean };
  cards: { style: "glass" | "solid" | "outline"; tilt: boolean };
}

export interface AnimationSettings {
  enabled: boolean;
  intro: boolean;
  intro_duration: number;
  speed: number;
  intensity: number;
  scroll_reveal: "rise" | "fade" | "blur" | "scale" | "none";
  magnetic_strength: number;
  cursor: boolean;
  smooth_scroll: boolean;
  three_d: boolean;
  particles: boolean;
  page_transitions: boolean;
  sound: boolean;
}

export interface SiteSettings {
  company: { name: string; legal_name: string; tax_id: string; address: string; tagline: string; description: string };
  contact: { email: string; phone: string; whatsapp: string; whatsapp_message: string; hours: string };
  social: Record<string, string>;
  branding: { logo_dark_bg: string; logo_light_bg: string; mark: string; favicon: string; nova_avatar: string };
  seo_defaults: { site_url: string; title_template: string; default_title: string; description: string; og_image: string; twitter_handle: string };
  locales: { default: string; enabled: string[]; available: string[] };
  cookies: { version: string; banner_title: string; banner_text: string };
  privacy: { consent_version: string; conversation_retention_days: number; analytics_retention_days: number; lead_retention_note: string };
  site_status: { maintenance: boolean; message: string };
  analytics: { enabled: boolean };
  challenge: {
    enabled: boolean;
    quiz_questions: number;
    quiz_duration_seconds: number;
    coupon_percent: number;
    coupon_valid_days: number;
    coupon_conditions: string;
    ttt_levels: Record<string, { label: string; mistake_rate: number }>;
    ttt_reward_levels: string[];
  };
}
