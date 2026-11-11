// Analíticas propias: solo con consentimiento, sin cookies, sin IP en claro.
import { safeStorage } from "./utils";
import { accessToken } from "./supabase";

type EventName = "page_view" | "cta_click" | "nova_open" | "nova_message" | "quote_view" | "form_submit" | "template_open" | "game_start" | "outbound_click";

let enabled = false;
let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function setAnalyticsEnabled(value: boolean) {
  enabled = value;
  if (!value) queue = [];
}

function sessionId(): string {
  let id = safeStorage.get("nv-sid", true);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    safeStorage.set("nv-sid", id, true);
  }
  return id;
}

function device(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

async function flush() {
  timer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, 20);
  const token = await accessToken();
  try {
    await fetch("/api/analytics", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(batch),
    });
  } catch {
    /* las analíticas nunca bloquean la navegación */
  }
}

export function track(name: EventName, props: Record<string, string | number | boolean> = {}) {
  if (!enabled) return;
  queue.push({ name, path: window.location.pathname, session_id: sessionId(), props, referrer: name === "page_view" ? document.referrer : undefined, device: device() });
  if (!timer) timer = setTimeout(flush, 1200);
}
