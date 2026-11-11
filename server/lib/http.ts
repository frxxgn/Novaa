import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";
import { env } from "../env.js";

export class ApiError extends HTTPException {
  code: string;
  constructor(status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 500 | 503, code: string, message: string) {
    super(status, { message });
    this.code = code;
  }
}

export const badRequest = (msg: string, code = "bad_request") => new ApiError(400, code, msg);
export const unauthorized = (msg = "Inicia sesión para continuar.") => new ApiError(401, "unauthorized", msg);
export const forbidden = (msg = "No tienes permiso para realizar esta acción.") => new ApiError(403, "forbidden", msg);
export const notFound = (msg = "No encontrado.") => new ApiError(404, "not_found", msg);
export const tooMany = (msg = "Demasiadas peticiones. Inténtalo de nuevo en unos minutos.") => new ApiError(429, "rate_limited", msg);
export const unavailable = (msg: string, code = "unavailable") => new ApiError(503, code, msg);

/** Lee y valida el cuerpo JSON con un esquema zod. Nunca confía en el cliente. */
export async function readJson<T>(c: Context, schema: ZodType<T>, maxBytes = 64 * 1024): Promise<T> {
  const length = Number(c.req.header("content-length") || "0");
  if (length > maxBytes) throw new ApiError(422, "payload_too_large", "La petición es demasiado grande.");
  let raw: unknown;
  try {
    const text = await c.req.text();
    if (text.length > maxBytes) throw new ApiError(422, "payload_too_large", "La petición es demasiado grande.");
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw badRequest("JSON no válido.", "invalid_json");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "datos";
    throw new ApiError(422, "validation_error", `Dato no válido (${path}): ${issue?.message ?? "revisa el formulario"}`);
  }
  return parsed.data;
}

export function clientIp(c: Context): string {
  if (env.trustProxy) {
    const fwd = c.req.header("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const real = c.req.header("x-real-ip");
    if (real) return real.trim();
  }
  // @hono/node-server expone la conexión en env.incoming
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress ?? "0.0.0.0";
}

/** Hash con sal: permite detectar abusos sin guardar la IP en claro. */
export function hashValue(value: string): string {
  return createHash("sha256").update(`${env.hashSalt}:${value}`).digest("hex");
}

export function ipHash(c: Context): string {
  return hashValue(`ip:${clientIp(c)}`).slice(0, 32);
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Elimina caracteres de control y recorta texto libre. */
export function cleanText(value: string, max = 4000): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
