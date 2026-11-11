// Integración con Claude (API de Anthropic) para Nova.
// - Bucle manual con streaming: el texto llega al usuario en tiempo real.
// - Herramientas validadas en servidor (tools.ts).
// - El historial se guarda sin bloques de «thinking» (eliminarlos todos es
//   compatible con la comprobación de historial de los modelos actuales).
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import type { NovaConfig } from "./config.js";
import { runTool, toolDefinitions, type ToolContext } from "./tools.js";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlock;

let client: Anthropic | null = null;
function claude(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: env.anthropicApiKey,
      baseURL: env.anthropicBaseUrl,
      maxRetries: 2,
      timeout: 120_000,
    });
  }
  return client;
}

/** Modelos que admiten el parámetro de servidor `fallbacks: "default"`. */
const FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export interface AiTurnResult {
  /** Mensajes nuevos (sin thinking) para persistir tras el mensaje del usuario. */
  appended: MessageParam[];
  text: string;
  tokensIn: number;
  tokensOut: number;
  stopReason: string | null;
}

/** Conserva solo texto y llamadas/resultados de herramientas para el historial. */
export function persistableContent(blocks: ContentBlock[]): Anthropic.Beta.BetaContentBlockParam[] {
  const out: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const b of blocks) {
    if (b.type === "text" && b.text) out.push({ type: "text", text: b.text });
    else if (b.type === "tool_use") out.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
  }
  return out;
}

export async function runAiTurn(params: {
  cfg: NovaConfig;
  system: string;
  history: MessageParam[];
  userMessage: MessageParam;
  ctx: ToolContext;
  signal?: AbortSignal;
}): Promise<AiTurnResult> {
  const { cfg, system, history, userMessage, ctx, signal } = params;
  const model = env.novaModelOverride || cfg.model;
  const tools = toolDefinitions(cfg);
  const messages: MessageParam[] = [...history, userMessage];
  const appended: MessageParam[] = [];
  let text = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let stopReason: string | null = null;

  for (let iteration = 0; iteration < 6; iteration++) {
    const useFallbacks = env.novaServerFallbacks && FALLBACK_MODELS.has(model);
    const stream = claude().beta.messages.stream(
      {
        model,
        max_tokens: cfg.max_output_tokens,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages,
        ...(tools.length ? { tools } : {}),
        thinking: { type: "adaptive" },
        output_config: { effort: cfg.effort },
        ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal },
    );

    stream.on("text", (delta) => {
      text += delta;
      ctx.emit({ type: "delta", text: delta });
    });

    const message = await stream.finalMessage();
    tokensIn += (message.usage.input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    tokensOut += message.usage.output_tokens ?? 0;
    stopReason = message.stop_reason;

    if (message.stop_reason === "refusal") {
      const notice = "No puedo ayudarte con esa petición. Si lo necesitas, el equipo de Novalius puede atenderte personalmente.";
      ctx.emit({ type: "delta", text: (text ? "\n\n" : "") + notice });
      text += (text ? "\n\n" : "") + notice;
      appended.push({ role: "assistant", content: [{ type: "text", text: notice }] });
      break;
    }

    // En curso: el contenido se reenvía íntegro (con thinking) dentro de este turno.
    messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
    const stored = persistableContent(message.content);
    if (stored.length) appended.push({ role: "assistant", content: stored });

    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;
    if (message.stop_reason === "max_tokens") {
      // Entrada de herramienta posiblemente truncada: no se ejecuta.
      break;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of toolUses) {
      const outcome = await runTool(call.name, call.input, ctx);
      results.push({ type: "tool_result", tool_use_id: call.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
    }
    const toolMessage: MessageParam = { role: "user", content: results };
    messages.push(toolMessage);
    appended.push(toolMessage);
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      ctx.emit({ type: "delta", text: "\n\n" });
    }
  }

  // El historial debe terminar en un turno del asistente con contenido.
  const last = appended[appended.length - 1];
  if (!last || last.role !== "assistant") {
    appended.push({ role: "assistant", content: [{ type: "text", text: text.trim() || "…" }] });
  }

  return { appended, text: text.trim(), tokensIn, tokensOut, stopReason };
}

export function isAnthropicError(e: unknown): e is InstanceType<typeof Anthropic.APIError> {
  return e instanceof Anthropic.APIError;
}

export function describeAiError(e: unknown): { status: number; kind: string } {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, kind: "rate_limit" };
  if (e instanceof Anthropic.AuthenticationError) return { status: 401, kind: "auth" };
  if (e instanceof Anthropic.BadRequestError) return { status: 400, kind: "bad_request" };
  if (e instanceof Anthropic.APIConnectionError) return { status: 503, kind: "connection" };
  if (e instanceof Anthropic.APIError) return { status: e.status ?? 500, kind: "api" };
  return { status: 500, kind: "unknown" };
}
