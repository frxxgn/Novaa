import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Context } from "hono";
import { env, integrations } from "../env.js";
import { forbidden, unauthorized, unavailable } from "./http.js";

let adminClient: SupabaseClient | null = null;

/** Cliente con clave secreta (service_role): SOLO en servidor. Omite RLS. */
export function admin(): SupabaseClient {
  if (!integrations.supabase) {
    throw unavailable("El backend no está configurado (SUPABASE_URL / SUPABASE_SECRET_KEY).", "backend_not_configured");
  }
  if (!adminClient) {
    adminClient = createClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-client-info": "novalius-api" } },
    });
  }
  return adminClient;
}

/** Cliente que actúa como el usuario (aplica RLS con su JWT). */
export function asUser(token: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabasePublishableKey || env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export interface AuthInfo {
  user: User;
  token: string;
  roles: string[];
  permissions: string[];
}

function bearer(c: Context): string | null {
  const header = c.req.header("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1]!.trim() : null;
}

/** Verifica el JWT contra Supabase Auth (no se confía en datos del navegador). */
export async function getAuth(c: Context): Promise<AuthInfo | null> {
  const cached = c.get("auth") as AuthInfo | null | undefined;
  if (cached !== undefined) return cached;
  const token = bearer(c);
  if (!token) {
    c.set("auth", null);
    return null;
  }
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) {
    c.set("auth", null);
    return null;
  }
  const { data: access } = await asUser(token).rpc("my_access");
  const info: AuthInfo = {
    user: data.user,
    token,
    roles: Array.isArray(access?.roles) ? access.roles : [],
    permissions: Array.isArray(access?.permissions) ? access.permissions : [],
  };
  c.set("auth", info);
  return info;
}

export async function requireAuth(c: Context, opts: { verified?: boolean } = {}): Promise<AuthInfo> {
  const auth = await getAuth(c);
  if (!auth) throw unauthorized();
  if (opts.verified && !auth.user.email_confirmed_at) {
    throw forbidden("Verifica tu correo electrónico para usar esta función.");
  }
  return auth;
}

export async function requirePermission(c: Context, permission: string): Promise<AuthInfo> {
  const auth = await requireAuth(c);
  if (!auth.roles.includes("admin") && !auth.permissions.includes(permission)) {
    throw forbidden(`Permiso necesario: ${permission}`);
  }
  return auth;
}

/** Ajustes de site_settings con caché breve (los cambios del panel se ven en <30 s). */
const settingsCache = new Map<string, { at: number; value: Record<string, unknown> }>();
export async function getSetting<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
  const hit = settingsCache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return { ...fallback, ...(hit.value as T) };
  const { data } = await admin().from("site_settings").select("value").eq("key", key).maybeSingle();
  const value = (data?.value ?? {}) as Record<string, unknown>;
  settingsCache.set(key, { at: Date.now(), value });
  return { ...fallback, ...(value as T) };
}

export function clearSettingsCache() {
  settingsCache.clear();
}

/** Limitación de peticiones con ventana fija almacenada en PostgreSQL. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true; // no bloquear por un fallo interno del limitador
  }
  return data === true;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthInfo | null;
  }
}
