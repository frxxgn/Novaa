import { createClient } from "@supabase/supabase-js";

// La URL puede ser absoluta (producción) o relativa (/supabase) cuando la web
// se sirve tras un proxy del mismo origen (previsualizaciones).
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

function resolveUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  return url;
}

export const supabaseUrl = resolveUrl(rawUrl);
export const supabaseConfigured = Boolean(supabaseUrl && key);

export const supabase = createClient(supabaseUrl || "http://localhost:54321", key || "missing-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "nv-auth",
  },
});

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** URL pública de un archivo del bucket «media». */
export function mediaUrl(path: string): string {
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}
