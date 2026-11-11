// Cabeceras de seguridad comunes (también replicadas en vercel.json).
export function securityHeaders(supabaseUrl: string): Record<string, string> {
  let supabaseOrigin = "";
  try {
    if (supabaseUrl && /^https?:\/\//.test(supabaseUrl)) supabaseOrigin = new URL(supabaseUrl).origin;
  } catch {
    supabaseOrigin = "";
  }
  const connect = ["'self'", supabaseOrigin, supabaseOrigin.replace(/^http/, "ws")].filter(Boolean).join(" ");
  const img = ["'self'", "data:", "blob:", supabaseOrigin].filter(Boolean).join(" ");
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    `media-src ${img}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-Frame-Options": "SAMEORIGIN",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}
