import { accessToken } from "./supabase";

export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function headersFor(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await accessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: await headersFor(opts.headers),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "network", "No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiClientError(res.status, err?.code ?? "error", err?.message ?? "Se ha producido un error. Inténtalo de nuevo.");
  }
  return json as T;
}

/** Descarga un archivo de la API autenticada (exportaciones). */
export async function downloadApi(path: string, fallbackName: string) {
  const res = await fetch(`/api${path}`, { headers: await headersFor() });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiClientError(res.status, "download", json?.error?.message ?? "No se pudo descargar el archivo.");
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Petición con respuesta en streaming (Server-Sent Events). */
export async function streamApi(path: string, body: unknown, onEvent: (event: string, data: unknown) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`/api${path}`, { method: "POST", headers: await headersFor({ Accept: "text/event-stream" }), body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiClientError(res.status, json?.error?.code ?? "error", json?.error?.message ?? "No se pudo enviar el mensaje.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue;
      try {
        onEvent(event, JSON.parse(data.join("\n")));
      } catch {
        onEvent(event, data.join("\n"));
      }
    }
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const msg = (e as { message: string }).message;
    if (/permission denied|row-level security/i.test(msg)) return "No tienes permiso para realizar esta acción.";
    if (/duplicate key/i.test(msg)) return "Ya existe un registro con ese valor.";
    if (/violates check constraint/i.test(msg)) return "Algún dato no tiene un formato válido.";
    return msg;
  }
  return "Se ha producido un error inesperado.";
}
