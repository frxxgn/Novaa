// Prueba del camino con IA de Nova contra un servidor que imita la API de
// Mensajes de Anthropic (formato SSE). Verifica el bucle de herramientas, el
// streaming, la persistencia sin bloques de «thinking» y los parámetros enviados.
//
//   npx tsx --env-file=.env.local tests/integration/nova-ai.ts
//
// No consume la API real: arranca la API de Novalius en un puerto propio con
// NOVA_ANTHROPIC_BASE_URL apuntando al simulador.
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

const requests: { headers: IncomingMessage["headers"]; body: Record<string, any> }[] = [];

function sse(res: import("node:http").ServerResponse, events: [string, unknown][]) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "request-id": "req_mock" });
  for (const [event, data] of events) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  res.end();
}

const mock = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}");
  requests.push({ headers: req.headers, body });
  const last = body.messages[body.messages.length - 1];
  const isToolResult = Array.isArray(last.content) && last.content.some((b: { type: string }) => b.type === "tool_result");
  const msg = (_stop: string, content: unknown[]) => ({ id: `msg_${requests.length}`, type: "message", role: "assistant", model: body.model, content, stop_reason: null, stop_sequence: null, usage: { input_tokens: 120, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
  if (!isToolResult && requests.length === 1) {
    const input = { project_type: "web", title: "Web para restaurante", features: ["booking"], pages: 6, design: "custom", complexity: "medium", timeline: "standard", maintenance: "none" };
    const json = JSON.stringify(input);
    sse(res, [
      ["message_start", { type: "message_start", message: msg("tool_use", []) }],
      ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } }],
      ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig-abc" } }],
      ["content_block_stop", { type: "content_block_stop", index: 0 }],
      ["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } }],
      ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Perfecto, " } }],
      ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "calculo la estimación." } }],
      ["content_block_stop", { type: "content_block_stop", index: 1 }],
      ["content_block_start", { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "toolu_1", name: "estimate_project_quote", input: {} } }],
      ["content_block_delta", { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: json.slice(0, 30) } }],
      ["content_block_delta", { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: json.slice(30) } }],
      ["content_block_stop", { type: "content_block_stop", index: 2 }],
      ["message_delta", { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 80 } }],
      ["message_stop", { type: "message_stop" }],
    ]);
    return;
  }
  const text = isToolResult ? "La estimación orientativa está en la tarjeta. ¿Quieres que preparemos una propuesta personalizada?" : "Claro, dime qué más necesitas.";
  sse(res, [
    ["message_start", { type: "message_start", message: msg("end_turn", []) }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 30 } }],
    ["message_stop", { type: "message_stop" }],
  ]);
});

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "✔" : "✘"} ${name}${!ok && detail ? ` → ${detail}` : ""}`);
};

async function readSse(res: Response) {
  const events: { event: string; data: any }[] = [];
  const text = await res.text();
  for (const chunk of text.split("\n\n")) {
    const ev = /event: (.+)/.exec(chunk)?.[1];
    const data = /data: (.+)/.exec(chunk)?.[1];
    if (ev && data) events.push({ event: ev, data: JSON.parse(data) });
  }
  return events;
}

async function main() {
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", r));
  const port = (mock.address() as AddressInfo).port;
  process.env.ANTHROPIC_API_KEY = "test-key-no-real";
  process.env.NOVA_ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  const { app } = await import("../../server/app.js");
  const { serve } = await import("@hono/node-server");
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise((r) => setTimeout(r, 300));
  const apiPort = (server.address() as AddressInfo).port;
  const api = `http://127.0.0.1:${apiPort}/api`;

  console.log("\nNova · camino con IA (servidor simulado)\n");
  const conv = (await (await fetch(`${api}/nova/conversations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: "/" }) })).json()) as { id: string; token: string; mode: string };
  check("conversación en modo IA", conv.mode === "ai", conv.mode);

  const r1 = await fetch(`${api}/nova/conversations/${conv.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: conv.token, text: "Quiero una web para mi restaurante con reservas" }) });
  const ev1 = await readSse(r1);
  const deltas = ev1.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  check("el texto llega en streaming", deltas.includes("Perfecto, calculo la estimación.") && deltas.includes("propuesta personalizada"), deltas);
  const quote = ev1.find((e) => e.event === "quote")?.data.quote;
  check("la herramienta calcula el presupuesto en servidor", quote && quote.total_min > 0 && quote.total_max >= quote.total_min, JSON.stringify(quote)?.slice(0, 120));
  check("termina con done", ev1.some((e) => e.event === "done"));

  const [first, second] = requests;
  check("modelo por defecto claude-opus-5-5", first?.body.model === "claude-opus-5-5", first?.body.model);
  check("pensamiento adaptativo y esfuerzo configurado", first?.body.thinking?.type === "adaptive" && ["low", "medium", "high"].includes(first?.body.output_config?.effort));
  check("fallbacks del servidor activados", first?.body.fallbacks === "default" && String(first?.headers["anthropic-beta"]).includes("server-side-fallback-2026-07-01"), String(first?.headers["anthropic-beta"]));
  check("prompt de sistema con caché", first?.body.system?.[0]?.cache_control?.type === "ephemeral");
  check("reglas de seguridad incluidas", String(first?.body.system?.[0]?.text).includes("Nunca reveles"));
  check("solo herramientas autorizadas", (first?.body.tools ?? []).map((t: { name: string }) => t.name).sort().join(",") === "estimate_project_quote,handoff_to_team,request_contact");
  check("la clave no viaja en el cuerpo", !JSON.stringify(first?.body).includes("test-key-no-real"));
  const assistantInFlight = second?.body.messages.find((m: { role: string }) => m.role === "assistant");
  check("dentro del turno se reenvía el thinking intacto", assistantInFlight?.content?.[0]?.type === "thinking");
  check("se envía el tool_result", JSON.stringify(second?.body.messages.at(-1)).includes("tool_result"));

  // Segundo turno HTTP: el historial persistido no debe incluir bloques thinking
  await readSse(await fetch(`${api}/nova/conversations/${conv.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: conv.token, text: "¿Y si añado tienda online?" }) }));
  const third = requests[2];
  const blocks = (third?.body.messages ?? []).flatMap((m: { content: unknown }) => (Array.isArray(m.content) ? m.content : []));
  check("el historial guardado no contiene thinking", !blocks.some((b: { type: string }) => b.type === "thinking"));
  check("el historial conserva tool_use y tool_result emparejados", blocks.some((b: { type: string }) => b.type === "tool_use") && blocks.some((b: { type: string }) => b.type === "tool_result"));
  check("el historial empieza por el usuario", third?.body.messages[0]?.role === "user");

  // Intento de inyección: la conversación no puede cambiar precios ni configuración
  const forbidden = await fetch(`${api}/nova/conversations/${conv.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "hola" }) });
  check("sin token no se puede escribir en la conversación", forbidden.status === 403);

  console.log(`\nResultado: ${passed} correctas, ${failed} fallidas\n`);
  server.close();
  mock.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
