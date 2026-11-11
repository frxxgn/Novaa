// Configuración del servidor. Los secretos SOLO se leen aquí (nunca con prefijo
// VITE_, que los expondría al navegador).

function read(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

function bool(name: string, fallback = false): boolean {
  const v = read(name).toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

export const env = {
  nodeEnv: read("NODE_ENV") || "development",
  siteUrl: read("SITE_URL") || read("VITE_SITE_URL") || "http://localhost:5173",

  // Supabase
  supabaseUrl: read("SUPABASE_URL") || read("VITE_SUPABASE_URL"),
  supabaseSecretKey: read("SUPABASE_SECRET_KEY") || read("SUPABASE_SERVICE_ROLE_KEY"),
  supabasePublishableKey: read("SUPABASE_PUBLISHABLE_KEY") || read("VITE_SUPABASE_PUBLISHABLE_KEY"),

  // IA (Anthropic). Nova usa el modo guiado si no hay clave.
  anthropicApiKey: read("ANTHROPIC_API_KEY"),
  // Se usa una variable propia para no heredar ANTHROPIC_BASE_URL del entorno.
  anthropicBaseUrl: read("NOVA_ANTHROPIC_BASE_URL") || "https://api.anthropic.com",
  novaModelOverride: read("NOVA_MODEL"),
  novaServerFallbacks: bool("NOVA_SERVER_FALLBACKS", true),

  // Correo: "smtp" o "resend"
  emailProvider: read("EMAIL_PROVIDER"),
  emailFrom: read("EMAIL_FROM") || "Novalius <no-reply@novalius.local>",
  smtpHost: read("SMTP_HOST"),
  smtpPort: Number(read("SMTP_PORT") || "587"),
  smtpUser: read("SMTP_USER"),
  smtpPass: read("SMTP_PASS"),
  smtpSecure: bool("SMTP_SECURE", false),
  resendApiKey: read("RESEND_API_KEY"),

  // WhatsApp Business Cloud API (Meta)
  whatsappToken: read("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: read("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappApiVersion: read("WHATSAPP_API_VERSION") || "v21.0",

  // Seguridad
  hashSalt: read("APP_HASH_SALT") || "novalius-dev-salt-change-me",
  cronSecret: read("CRON_SECRET"),
  trustProxy: bool("TRUST_PROXY", true),
};

export const integrations = {
  supabase: Boolean(env.supabaseUrl && env.supabaseSecretKey),
  ai: Boolean(env.anthropicApiKey),
  email:
    (env.emailProvider === "smtp" && Boolean(env.smtpHost)) ||
    (env.emailProvider === "resend" && Boolean(env.resendApiKey)),
  whatsapp: Boolean(env.whatsappToken && env.whatsappPhoneNumberId),
};
