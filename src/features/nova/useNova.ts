import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiClientError, streamApi } from "@/lib/api";
import { safeStorage } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useAuth } from "@/app/auth";
import type { NovaPublicConfig } from "@/services/content";
import type { QuoteSummary } from "@/shared/pricing";

export interface ContactPrefill {
  name: string;
  email: string;
  phone: string;
  company: string;
  summary: string;
  quote_id: string | null;
}

export interface NovaMessage {
  id: string;
  role: "user" | "assistant" | "event";
  content: string;
  quote?: QuoteSummary;
  contact?: ContactPrefill;
  quickReplies?: string[];
  multi?: boolean;
  status?: string;
  streaming?: boolean;
  error?: boolean;
  handoff?: boolean;
}

interface StoredConv {
  id: string;
  token: string;
}

const KEY = "nv-nova-conv";
const QUOTES_KEY = "nv-quote-tokens";

/** Guarda los tokens de presupuestos anónimos para poder reclamarlos al iniciar sesión. */
export function rememberQuoteToken(id: string, token: string) {
  try {
    const all = JSON.parse(safeStorage.get(QUOTES_KEY) ?? "{}") as Record<string, string>;
    all[id] = token;
    safeStorage.set(QUOTES_KEY, JSON.stringify(all));
  } catch {
    /* sin almacenamiento */
  }
}
export function quoteTokens(): Record<string, string> {
  try {
    return JSON.parse(safeStorage.get(QUOTES_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
export function forgetQuoteToken(id: string) {
  const all = quoteTokens();
  delete all[id];
  safeStorage.set(QUOTES_KEY, JSON.stringify(all));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function useNovaConfig() {
  return useQuery({ queryKey: ["nova-config"], queryFn: () => api<NovaPublicConfig>("/nova/config"), staleTime: 300_000, retry: 1 });
}

export function useNova() {
  const { user } = useAuth();
  const config = useNovaConfig();
  const [conv, setConv] = useState<StoredConv | null>(() => {
    try {
      const raw = safeStorage.get(KEY);
      return raw ? (JSON.parse(raw) as StoredConv) : null;
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState<"ai" | "guided">("guided");
  const [messages, setMessages] = useState<NovaMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const persist = (c: StoredConv | null) => {
    setConv(c);
    if (c) safeStorage.set(KEY, JSON.stringify(c));
    else safeStorage.remove(KEY);
  };

  const start = useCallback(async () => {
    setError(null);
    const res = await api<{ id: string; token: string; mode: "ai" | "guided"; welcome: string; quick_replies: string[] }>("/nova/conversations", { body: { page: window.location.pathname } });
    persist({ id: res.id, token: res.token });
    setMode(res.mode);
    setLeadSent(false);
    setMessages([{ id: uid(), role: "assistant", content: res.welcome, quickReplies: res.quick_replies }]);
    setLoaded(true);
    return { id: res.id, token: res.token };
  }, []);

  const load = useCallback(async (c: StoredConv) => {
    try {
      const res = await api<{ mode: "ai" | "guided"; lead_id: string | null; messages: { id: string; role: NovaMessage["role"]; content: string; payload: Record<string, unknown> }[]; quotes: Record<string, Record<string, unknown>> }>(`/nova/conversations/${c.id}?token=${encodeURIComponent(c.token)}`);
      setMode(res.mode);
      setLeadSent(Boolean(res.lead_id));
      const list: NovaMessage[] = res.messages
        .filter((m) => m.role !== "event" || (m.payload as { type?: string })?.type === "lead_created")
        .map((m) => {
          const p = m.payload ?? {};
          const q = p.quote_id ? res.quotes[p.quote_id as string] : undefined;
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            quickReplies: (p.quick_replies as string[] | undefined) ?? undefined,
            contact: p.contact_request as ContactPrefill | undefined,
            handoff: Boolean(p.handoff),
            quote: q ? rowToQuote(q) : undefined,
          };
        });
      // Solo las respuestas rápidas del último mensaje siguen activas
      setMessages(list.map((m, i) => (i === list.length - 1 ? m : { ...m, quickReplies: undefined })));
      setLoaded(true);
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
        persist(null);
        await start();
      } else throw e;
    }
  }, [start]);

  const ensure = useCallback(async () => {
    if (loaded && conv) return conv;
    if (conv) {
      await load(conv);
      return conv;
    }
    return start();
  }, [conv, loaded, load, start]);

  // Al iniciar sesión, la conversación anónima se asocia a la cuenta
  useEffect(() => {
    if (user && conv) void api(`/nova/conversations/${conv.id}/claim`, { body: { token: conv.token } }).catch(() => undefined);
  }, [user, conv]);

  const send = useCallback(
    async (text: string, choices?: string[]) => {
      const c = await ensure();
      const content = text.trim() || (choices ?? []).join(", ");
      if (!content) return;
      setError(null);
      track("nova_message");
      const assistantId = uid();
      setMessages((list) => [
        ...list.map((m) => ({ ...m, quickReplies: undefined })),
        { id: uid(), role: "user", content },
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const patch = (fn: (m: NovaMessage) => NovaMessage) => setMessages((list) => list.map((m) => (m.id === assistantId ? fn(m) : m)));
      try {
        await streamApi(
          `/nova/conversations/${c.id}/messages`,
          { token: c.token, text, choices, page: window.location.pathname },
          (event, data) => {
            const d = data as Record<string, unknown>;
            if (event === "delta") patch((m) => ({ ...m, content: m.content + String(d.text ?? ""), status: undefined }));
            else if (event === "status") patch((m) => ({ ...m, status: String(d.text ?? "") }));
            else if (event === "quote") {
              const quote = d.quote as QuoteSummary;
              if (quote.claim_token) rememberQuoteToken(quote.id, quote.claim_token);
              track("quote_view", { type: quote.project_type });
              patch((m) => ({ ...m, quote, status: undefined }));
            } else if (event === "contact_request") patch((m) => ({ ...m, contact: d.prefill as ContactPrefill }));
            else if (event === "handoff") patch((m) => ({ ...m, handoff: true }));
            else if (event === "quick_replies") patch((m) => ({ ...m, quickReplies: d.options as string[], multi: Boolean(d.multi) }));
            else if (event === "error") patch((m) => ({ ...m, error: true, content: m.content || String(d.message ?? "") }));
          },
          ctrl.signal,
        );
      } catch (e) {
        const msg = e instanceof ApiClientError ? e.message : "No se pudo enviar el mensaje.";
        patch((m) => ({ ...m, error: true, content: m.content || msg }));
        setError(msg);
      } finally {
        patch((m) => ({ ...m, streaming: false, status: undefined }));
        setBusy(false);
      }
    },
    [ensure],
  );

  const submitContact = useCallback(
    async (data: { name: string; email: string; phone: string; company: string; message: string; consent: boolean; quote_id: string | null; whatsapp_opt_in: boolean }) => {
      if (!conv) throw new Error("Sin conversación");
      await api(`/nova/conversations/${conv.id}/contact`, { body: { ...data, token: conv.token, summary: data.message } });
      setLeadSent(true);
      track("form_submit", { form: "nova" });
      setMessages((list) => [...list, { id: uid(), role: "event", content: "Solicitud enviada al equipo" }]);
    },
    [conv],
  );

  const reset = useCallback(async () => {
    abortRef.current?.abort();
    persist(null);
    setMessages([]);
    setLoaded(false);
    await start();
  }, [start]);

  const openConversation = useCallback(
    async (id: string) => {
      // Conversaciones del historial de la cuenta (acceso por propiedad)
      const c = { id, token: "" };
      persist(c);
      setLoaded(false);
      await load(c);
    },
    [load],
  );

  return { config: config.data, configLoading: config.isLoading, conv, mode, messages, busy, loaded, error, leadSent, ensure, send, submitContact, reset, openConversation, stop: () => abortRef.current?.abort() };
}

/** Convierte una fila de quotes (+quote_items) en el formato de la tarjeta. */
export function rowToQuote(q: Record<string, unknown>): QuoteSummary {
  const items = ((q.quote_items as Record<string, unknown>[] | undefined) ?? [])
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((i) => ({ kind: i.kind as QuoteSummary["items"][number]["kind"], rule_key: String(i.rule_key ?? ""), label: String(i.label), detail: String(i.detail ?? ""), quantity: Number(i.quantity ?? 1), min: Number(i.min_amount), max: Number(i.max_amount), is_optional: Boolean(i.is_optional) }));
  const snap = (q.rules_snapshot ?? {}) as { reviewed?: boolean; assumptions?: string[] };
  return {
    id: String(q.id),
    reference: String(q.reference ?? ""),
    project_type: q.project_type as QuoteSummary["project_type"],
    project_label: String(q.title ?? ""),
    title: String(q.title ?? ""),
    currency: String(q.currency ?? "EUR"),
    total_min: Number(q.total_min),
    total_max: Number(q.total_max),
    monthly_min: Number(q.monthly_min ?? 0),
    monthly_max: Number(q.monthly_max ?? 0),
    items,
    factors: (q.factors as string[]) ?? [],
    included: (q.included as string[]) ?? [],
    optional: (q.optional as QuoteSummary["optional"]) ?? [],
    assumptions: snap.assumptions ?? [],
    disclaimer: String(q.disclaimer ?? ""),
    vat_note: "Importes sin IVA.",
    references: ((q.references_used as QuoteSummary["references"]) ?? []),
    reviewed: Boolean(snap.reviewed),
    created_at: String(q.created_at ?? ""),
    valid_until: (q.valid_until as string | null) ?? null,
  };
}
