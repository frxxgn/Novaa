import type Anthropic from "@anthropic-ai/sdk";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { integrations } from "../env.js";
import { ApiError, badRequest, cleanText, forbidden, ipHash, notFound, randomToken, readJson, sha256, tooMany } from "../lib/http.js";
import { admin, getAuth, getSetting, rateLimit } from "../lib/supabase.js";
import { createLead, leadInputSchema } from "../leads/service.js";
import { createQuote } from "../quotes/service.js";
import { buildSystemPrompt, loadNovaConfig } from "../nova/config.js";
import { describeAiError, runAiTurn } from "../nova/ai.js";
import { guidedStart, guidedTurn, type GuidedState } from "../nova/guided.js";
import type { NovaEvent, ToolContext } from "../nova/tools.js";

type MessageParam = Anthropic.Beta.BetaMessageParam;

const SECURITY_DEFAULTS = { nova_per_minute: 12, nova_per_day: 200, leads_per_hour: 6 };

export const nova = new Hono();

nova.get("/config", async (c) => {
  const cfg = await loadNovaConfig();
  const contact = await getSetting("contact", { whatsapp: "", whatsapp_message: "", email: "" });
  return c.json({
    name: cfg.name,
    avatar_url: cfg.avatar_url,
    welcome_message: cfg.welcome_message,
    starter_questions: cfg.starter_questions,
    ai_disclosure: cfg.ai_disclosure,
    enabled: cfg.enabled,
    mode: integrations.ai ? "ai" : "guided",
    whatsapp: contact.whatsapp ? { number: String(contact.whatsapp).replace(/[^\d]/g, ""), message: contact.whatsapp_message } : null,
    email: contact.email || null,
  });
});

interface ConversationRow {
  id: string;
  user_id: string | null;
  access_hash: string;
  mode: "ai" | "guided";
  status: string;
  guided_state: GuidedState | Record<string, never>;
  message_count: number;
  title: string;
  quote_id: string | null;
  lead_id: string | null;
  tokens_in: number;
  tokens_out: number;
}

async function loadConversation(c: Parameters<typeof getAuth>[0], id: string, token: string | undefined): Promise<ConversationRow> {
  if (!z.uuid().safeParse(id).success) throw notFound("Conversación no encontrada.");
  const { data } = await admin().from("conversations").select("id, user_id, access_hash, mode, status, guided_state, message_count, title, quote_id, lead_id, tokens_in, tokens_out").eq("id", id).maybeSingle();
  if (!data) throw notFound("Conversación no encontrada.");
  const conv = data as ConversationRow;
  const auth = await getAuth(c);
  const ownerOk = Boolean(auth && conv.user_id && conv.user_id === auth.user.id);
  const tokenOk = Boolean(token && sha256(token) === conv.access_hash);
  if (!ownerOk && !tokenOk) throw forbidden("No tienes acceso a esta conversación.");
  return conv;
}

const startSchema = z.object({
  page: z.string().max(300).optional(),
  utm: z.record(z.string(), z.string().max(120)).optional(),
});

nova.post("/conversations", async (c) => {
  const body = await readJson(c, startSchema);
  const cfg = await loadNovaConfig();
  if (!cfg.enabled) throw new ApiError(503, "nova_disabled", cfg.error_messages.disabled);
  const ip = ipHash(c);
  if (!(await rateLimit(`nova:start:${ip}`, 30, 3600))) throw tooMany(cfg.error_messages.rate_limited);

  const auth = await getAuth(c);
  const token = randomToken(24);
  const mode = integrations.ai ? "ai" : "guided";
  const guided = mode === "guided" ? guidedStart() : null;
  const { data, error } = await admin()
    .from("conversations")
    .insert({
      user_id: auth?.user.id ?? null,
      access_hash: sha256(token),
      mode,
      guided_state: guided?.state ?? {},
      metadata: { page: body.page ?? "", utm: body.utm ?? {} },
      ip_hash: ip,
    })
    .select("id, created_at")
    .single();
  if (error || !data) throw error ?? new Error("No se pudo iniciar la conversación");

  const welcome = mode === "guided" ? `${cfg.welcome_message}\n\n${guided!.text}` : cfg.welcome_message;
  await admin().from("messages").insert({
    conversation_id: data.id,
    role: "assistant",
    content: welcome,
    payload: { type: "welcome", quick_replies: guided?.options ?? cfg.starter_questions },
  });

  return c.json({
    id: data.id,
    token,
    mode,
    welcome,
    quick_replies: guided?.options ?? cfg.starter_questions,
  });
});

nova.get("/conversations", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ conversations: [] });
  const { data } = await admin()
    .from("conversations")
    .select("id, title, mode, status, message_count, last_message_at, created_at")
    .eq("user_id", auth.user.id)
    .order("last_message_at", { ascending: false })
    .limit(30);
  return c.json({ conversations: data ?? [] });
});

nova.get("/conversations/:id", async (c) => {
  const conv = await loadConversation(c, c.req.param("id"), c.req.query("token") || c.req.header("x-conversation-token"));
  const { data: messages } = await admin()
    .from("messages")
    .select("id, role, content, payload, created_at")
    .eq("conversation_id", conv.id)
    .in("role", ["user", "assistant", "event"])
    .order("created_at")
    .limit(300);

  // Adjunta los presupuestos referenciados para poder repintar las tarjetas
  const quoteIds = [...new Set((messages ?? []).map((m) => (m.payload as { quote_id?: string })?.quote_id).filter(Boolean))] as string[];
  let quotes: Record<string, unknown> = {};
  if (quoteIds.length) {
    const { data: q } = await admin().from("quotes").select("*, quote_items(*)").in("id", quoteIds);
    quotes = Object.fromEntries((q ?? []).map((row) => [row.id, row]));
  }
  return c.json({ id: conv.id, mode: conv.mode, status: conv.status, lead_id: conv.lead_id, messages: messages ?? [], quotes });
});

/** Vincula una conversación anónima a la cuenta tras iniciar sesión. */
nova.post("/conversations/:id/claim", async (c) => {
  const auth = await getAuth(c);
  if (!auth) throw forbidden("Inicia sesión para guardar la conversación.");
  const body = await readJson(c, z.object({ token: z.string().min(10).max(100) }));
  const conv = await loadConversation(c, c.req.param("id"), body.token);
  if (conv.user_id && conv.user_id !== auth.user.id) throw forbidden();
  await admin().from("conversations").update({ user_id: auth.user.id }).eq("id", conv.id);
  return c.json({ ok: true });
});

const messageSchema = z.object({
  token: z.string().max(100).optional(),
  text: z.string().max(4000).default(""),
  choices: z.array(z.string().max(120)).max(20).optional(),
  page: z.string().max(300).optional(),
});

async function historyFor(conversationId: string, windowRows: number): Promise<MessageParam[]> {
  const { data } = await admin()
    .from("messages")
    .select("role, api_content, created_at")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .not("api_content", "is", null)
    .order("created_at", { ascending: false })
    .limit(windowRows);
  const rows = (data ?? []).reverse();
  // El historial debe empezar por un turno de usuario (se descartan filas iniciales del asistente)
  while (rows.length && rows[0]!.role !== "user") rows.shift();
  return rows.flatMap((r) => (Array.isArray(r.api_content) ? (r.api_content as MessageParam[]) : []));
}

nova.post("/conversations/:id/messages", async (c) => {
  const body = await readJson(c, messageSchema);
  const conv = await loadConversation(c, c.req.param("id"), body.token);
  const cfg = await loadNovaConfig();
  const security = await getSetting("security", SECURITY_DEFAULTS);
  const text = cleanText(body.text, 4000);
  const choices = (body.choices ?? []).map((s) => cleanText(s, 120)).filter(Boolean);
  if (!text && !choices.length) throw badRequest("Escribe un mensaje.");
  if (!cfg.enabled) throw new ApiError(503, "nova_disabled", cfg.error_messages.disabled);
  if (conv.status === "blocked") throw forbidden("Esta conversación está bloqueada.");

  const ip = ipHash(c);
  const [okMinute, okDay] = await Promise.all([
    rateLimit(`nova:msg:${ip}`, Number(security.nova_per_minute) || 12, 60),
    rateLimit(`nova:day:${ip}`, Number(security.nova_per_day) || 200, 86400),
  ]);
  if (!okMinute || !okDay) throw tooMany(cfg.error_messages.rate_limited);

  const { count: userCount } = await admin().from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("role", "user");
  if ((userCount ?? 0) >= cfg.max_user_messages) throw new ApiError(429, "limit_reached", cfg.error_messages.limit_reached);

  const auth = await getAuth(c);
  const userText = text || choices.join(", ");
  const contextNote = `[Contexto de la web: página ${cleanText(body.page ?? "", 200) || "desconocida"}; sesión iniciada: ${auth ? "sí" : "no"}]`;
  const userMessage: MessageParam = { role: "user", content: [{ type: "text", text: `${userText}\n\n${contextNote}` }] };

  await admin().from("messages").insert({
    conversation_id: conv.id,
    role: "user",
    content: userText,
    api_content: conv.mode === "ai" ? [userMessage] : null,
  });

  return streamSSE(c, async (stream) => {
    const payload: Record<string, unknown> = {};
    const send = async (event: string, data: unknown) => {
      await stream.writeSSE({ event, data: JSON.stringify(data) });
    };
    const queue: Promise<void>[] = [];
    const emit = (e: NovaEvent) => {
      if (e.type === "quote") payload.quote_id = e.quote.id;
      if (e.type === "contact_request") payload.contact_request = e.prefill;
      if (e.type === "handoff") payload.handoff = true;
      if (e.type === "quick_replies") payload.quick_replies = e.options;
      queue.push(send(e.type, e));
    };

    const ctx: ToolContext = { conversationId: conv.id, userId: auth?.user.id ?? conv.user_id, emit };
    let assistantText = "";
    let apiContent: MessageParam[] | null = null;
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      await send("meta", { conversation_id: conv.id, mode: conv.mode });

      if (conv.mode === "ai") {
        const system = await buildSystemPrompt(cfg);
        const history = await historyFor(conv.id, cfg.history_window);
        // El mensaje actual ya está guardado; se excluye del historial para no duplicarlo.
        const prior = history.slice(0, Math.max(0, history.length - 1));
        const abort = new AbortController();
        stream.onAbort(() => abort.abort());
        const result = await runAiTurn({ cfg, system, history: prior, userMessage, ctx, signal: abort.signal });
        assistantText = result.text;
        apiContent = result.appended;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
      } else {
        const reply = guidedTurn(conv.guided_state as GuidedState, text, choices);
        assistantText = reply.text;
        emit({ type: "delta", text: reply.text });
        if (reply.quote) {
          emit({ type: "status", text: "Calculando presupuesto orientativo…" });
          const quote = await createQuote(reply.quote, { userId: ctx.userId, conversationId: conv.id, source: "nova" });
          emit({ type: "quote", quote });
        }
        if (reply.contact) {
          let prefill = { name: "", email: "", phone: "", company: "" };
          if (auth) {
            const { data: profile } = await admin().from("profiles").select("full_name, email, phone, company").eq("id", auth.user.id).maybeSingle();
            if (profile) prefill = { name: profile.full_name, email: profile.email, phone: profile.phone, company: profile.company };
          }
          const { data: convRow } = await admin().from("conversations").select("quote_id").eq("id", conv.id).maybeSingle();
          const d = (reply.state.data ?? {}) as Record<string, unknown>;
          emit({
            type: "contact_request",
            prefill: { ...prefill, summary: [d.business, d.goal].filter(Boolean).join(" · "), quote_id: convRow?.quote_id ?? null },
          });
        }
        if (reply.options.length) emit({ type: "quick_replies", options: reply.options, multi: reply.multi });
        await admin().from("conversations").update({ guided_state: reply.state }).eq("id", conv.id);
      }

      await Promise.all(queue);
      const { data: saved } = await admin()
        .from("messages")
        .insert({
          conversation_id: conv.id,
          role: "assistant",
          content: assistantText,
          payload,
          api_content: apiContent,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
        })
        .select("id")
        .single();

      await admin()
        .from("conversations")
        .update({
          message_count: conv.message_count + 2,
          last_message_at: new Date().toISOString(),
          title: conv.title || userText.slice(0, 80),
          tokens_in: conv.tokens_in + tokensIn,
          tokens_out: conv.tokens_out + tokensOut,
        })
        .eq("id", conv.id);

      await send("done", { message_id: saved?.id ?? null });
    } catch (e) {
      await Promise.allSettled(queue);
      const info = describeAiError(e);
      console.error("[nova]", info.kind, e instanceof Error ? e.message : e);
      const message = info.kind === "rate_limit" ? cfg.error_messages.rate_limited : cfg.error_messages.generic;
      await admin().from("messages").insert({ conversation_id: conv.id, role: "event", content: "Error al generar la respuesta", payload: { type: "error", kind: info.kind } });
      await send("error", { message });
    }
  });
});

const contactSchema = leadInputSchema.extend({
  token: z.string().max(100).optional(),
  quote_id: z.uuid().nullable().optional(),
  summary: z.string().max(2000).optional(),
});

nova.post("/conversations/:id/contact", async (c) => {
  const body = await readJson(c, contactSchema);
  const conv = await loadConversation(c, c.req.param("id"), body.token);
  const security = await getSetting("security", SECURITY_DEFAULTS);
  if (!(await rateLimit(`lead:${ipHash(c)}`, Number(security.leads_per_hour) || 6, 3600))) throw tooMany();
  if (conv.lead_id) return c.json({ ok: true, lead_id: conv.lead_id, already: true });

  // El presupuesto solo se vincula si pertenece a esta conversación
  let quoteId: string | null = null;
  if (body.quote_id) {
    const { data: q } = await admin().from("quotes").select("id, conversation_id").eq("id", body.quote_id).maybeSingle();
    if (q && q.conversation_id === conv.id) quoteId = q.id;
  }
  const auth = await getAuth(c);
  const lead = await createLead(
    { ...body, message: body.message || body.summary || "" },
    { source: "nova", sourceDetail: conv.mode === "ai" ? "Nova (IA)" : "Nova (modo guiado)", conversationId: conv.id, quoteId: quoteId ?? conv.quote_id, userId: auth?.user.id ?? null },
  );
  return c.json({ ok: true, lead_id: lead.id });
});
