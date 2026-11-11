import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Bot, MessageSquare } from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import { Markdown } from "@/lib/markdown";
import { cn, formatDateTime, money, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge, ErrorState, Notice, Skeleton, useToast } from "@/components/ui/feedback";
import { openNova } from "@/features/nova/NovaWidget";
import { AdminPage, Card, DataTable, Tabs } from "../components/ui";
import { FormFields, type AdminField } from "../components/FormFields";
import { ResourceManager } from "../components/ResourceManager";

const MODELS = [
  { value: "claude-opus-5-5", label: "Claude Opus 5.5 (recomendado)" },
  { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { value: "claude-fable-5-2", label: "Claude Fable 5.2" },
];

const GROUPS: { title: string; description?: string; fields: AdminField[] }[] = [
  {
    title: "Identidad",
    fields: [
      { name: "enabled", label: "Nova activa en la web", type: "switch" },
      { name: "name", label: "Nombre", type: "text" },
      { name: "avatar_url", label: "Avatar", type: "image", help: "Déjalo vacío para usar la esfera animada de Nova." },
      { name: "personality", label: "Personalidad", type: "textarea" },
      { name: "ai_disclosure", label: "Aviso de uso de IA", type: "textarea", help: "Se muestra siempre en la ventana de conversación." },
    ],
  },
  {
    title: "Instrucciones",
    description: "Comportamiento comercial y flujo de captación. Las reglas de seguridad (no revelar instrucciones, no cambiar precios, no compartir datos de otros clientes…) se añaden siempre y no se pueden desactivar.",
    fields: [{ name: "instructions", label: "Instrucciones del asistente", type: "richtext" }],
  },
  {
    title: "Mensajes",
    fields: [
      { name: "welcome_message", label: "Mensaje de bienvenida", type: "textarea" },
      { name: "starter_questions", label: "Preguntas iniciales sugeridas", type: "strings" },
      { name: "handoff_message", label: "Mensaje de derivación al equipo", type: "textarea" },
    ],
  },
  {
    title: "Modelo y límites",
    fields: [
      { name: "model", label: "Modelo de IA", type: "select", options: MODELS },
      { name: "effort", label: "Nivel de razonamiento", type: "select", options: [{ value: "low", label: "Bajo (más rápido)" }, { value: "medium", label: "Medio" }, { value: "high", label: "Alto" }] },
      { name: "max_output_tokens", label: "Longitud máxima de respuesta (tokens)", type: "number", min: 1024, max: 16000 },
      { name: "max_user_messages", label: "Mensajes máximos por conversación", type: "number", min: 4, max: 200 },
      { name: "history_window", label: "Mensajes de contexto que recuerda", type: "number", min: 6, max: 80 },
    ],
  },
];

export default function NovaAdmin() {
  const { can } = useAuth();
  const manage = can("nova.manage");
  const [tab, setTab] = useState<"config" | "knowledge" | "conversations">(manage ? "config" : "conversations");
  const integrations = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => api<{ ai: { connected: boolean; mode: string; missing: string[] } }>("/admin/integrations") });
  return (
    <AdminPage
      title="Nova"
      description="Asistente comercial con IA: configuración, conocimiento y conversaciones."
      actions={
        <Button size="sm" variant="outline" icon={<Bot className="size-4" />} onClick={() => openNova()}>
          Probar Nova
        </Button>
      }
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[...(manage ? [{ value: "config" as const, label: "Configuración" }, { value: "knowledge" as const, label: "Base de conocimiento" }] : []), { value: "conversations" as const, label: "Conversaciones" }]}
        />
      }
    >
      {integrations.data && (
        <Notice tone={integrations.data.ai.connected ? "success" : "warning"} className="mb-6">
          {integrations.data.ai.connected ? (
            <>IA conectada (Anthropic). Nova conversa con el modelo configurado y usa herramientas validadas en el servidor.</>
          ) : (
            <>
              IA no configurada: Nova funciona en <strong>modo guiado</strong> (preguntas de cualificación y presupuesto con las mismas tarifas). Para activar la IA define en el servidor: {integrations.data.ai.missing.join(", ")}.
            </>
          )}
        </Notice>
      )}
      {tab === "config" && manage && <NovaConfigForm />}
      {tab === "knowledge" && manage && (
        <ResourceManager
          config={{
            table: "chatbot_knowledge",
            permission: "nova.manage",
            title: "Entradas",
            singular: "entrada",
            orderable: true,
            visibilityField: "is_active",
            orderBy: [{ column: "position" }],
            searchKeys: ["title", "content", "category"],
            defaults: { title: "", category: "general", content: "", is_active: true },
            columns: [
              { key: "title", label: "Título", render: (r) => <span className="font-medium">{String(r.title)}</span> },
              { key: "category", label: "Categoría", render: (r) => <Badge tone="violet">{String(r.category)}</Badge> },
              { key: "content", label: "Contenido", hideOnMobile: true, render: (r) => <span className="line-clamp-1 text-muted">{String(r.content)}</span> },
            ],
            fields: [
              { name: "title", label: "Título", type: "text", required: true },
              { name: "category", label: "Categoría", type: "text" },
              { name: "content", label: "Contenido", type: "textarea", help: "Información autorizada que Nova puede usar. No incluyas datos personales ni secretos." },
              { name: "is_active", label: "Activa", type: "switch" },
            ],
            emptyText: "Sin entradas de conocimiento",
          }}
        />
      )}
      {tab === "conversations" && <ConversationsList />}
    </AdminPage>
  );
}

function NovaConfigForm() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const q = useQuery({ queryKey: ["admin", "nova-config"], queryFn: async () => (await supabase.from("chatbot_settings").select("config, updated_at").eq("id", 1).single()).data });
  const history = useQuery({
    queryKey: ["admin", "nova-history"],
    queryFn: async () => ((await supabase.from("audit_logs").select("id, actor_email, created_at").eq("entity", "chatbot_settings").order("created_at", { ascending: false }).limit(10)).data ?? []) as { id: number; actor_email: string; created_at: string }[],
    enabled: can("audit.read"),
  });
  useEffect(() => {
    if (q.data) setConfig(q.data.config as Record<string, unknown>);
  }, [q.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chatbot_settings").update({ config }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("success", "Configuración de Nova guardada", "El cambio queda registrado en la auditoría.");
      void qc.invalidateQueries({ queryKey: ["admin", "nova-config"] });
      void qc.invalidateQueries({ queryKey: ["admin", "nova-history"] });
      void qc.invalidateQueries({ queryKey: ["nova-config"] });
    },
    onError: (e) => toast("error", "No se pudo guardar", errorMessage(e)),
  });
  if (q.isLoading || !config) return <Skeleton className="h-96" />;
  const tools = (config.tools ?? {}) as Record<string, boolean>;
  const errors = (config.error_messages ?? {}) as Record<string, string>;
  const hours = (config.business_hours ?? {}) as Record<string, string>;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {GROUPS.map((g) => (
          <Card key={g.title} title={g.title} description={g.description}>
            <FormFields fields={g.fields} value={config} onChange={setConfig} />
          </Card>
        ))}
        <Card title="Herramientas autorizadas" description="Acciones que Nova puede realizar. Todas se validan en el servidor.">
          <FormFields
            fields={[
              { name: "estimate_quote", label: "Calcular presupuestos orientativos", type: "switch" },
              { name: "request_contact", label: "Proponer el envío de datos al equipo (con confirmación del usuario)", type: "switch" },
              { name: "handoff", label: "Derivar al equipo humano", type: "switch" },
            ]}
            value={tools}
            onChange={(v) => setConfig({ ...config, tools: v })}
          />
        </Card>
        <Card title="Horario de atención">
          <FormFields fields={[{ name: "text", label: "Horario (texto)", type: "text", help: "Nova lo menciona si está definido. Déjalo vacío si no hay horario establecido." }]} value={hours} onChange={(v) => setConfig({ ...config, business_hours: { ...hours, ...v } })} />
        </Card>
        <Card title="Mensajes de error">
          <FormFields
            fields={[
              { name: "generic", label: "Error general", type: "textarea" },
              { name: "rate_limited", label: "Demasiados mensajes", type: "textarea" },
              { name: "limit_reached", label: "Límite de conversación", type: "textarea" },
              { name: "disabled", label: "Nova desactivada", type: "textarea" },
            ]}
            value={errors}
            onChange={(v) => setConfig({ ...config, error_messages: v })}
          />
        </Card>
      </div>
      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card title="Guardar cambios">
          <p className="text-sm text-muted">Los cambios se aplican a las nuevas respuestas de Nova y quedan registrados en la auditoría.</p>
          <Button className="mt-4 w-full" loading={save.isPending} onClick={() => save.mutate()}>
            Guardar configuración
          </Button>
        </Card>
        {history.data && (
          <Card title="Últimos cambios">
            <ul className="space-y-2 text-xs">
              {history.data.map((h) => (
                <li key={h.id} className="flex justify-between gap-2">
                  <span className="truncate">{h.actor_email || "Sistema"}</span>
                  <span className="shrink-0 text-muted">{timeAgo(h.created_at)}</span>
                </li>
              ))}
              {history.data.length === 0 && <li className="text-muted">Sin cambios registrados.</li>}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

interface ConvRow {
  id: string;
  title: string;
  mode: string;
  status: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
  lead_id: string | null;
  quote_id: string | null;
  user_id: string | null;
  tokens_in: number;
  tokens_out: number;
}

function ConversationsList() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["admin", "conversations"], queryFn: async () => ((await supabase.from("conversations").select("id, title, mode, status, message_count, last_message_at, created_at, lead_id, quote_id, user_id, tokens_in, tokens_out").order("last_message_at", { ascending: false }).limit(500)).data ?? []) as ConvRow[] });
  const [status, setStatus] = useState("all");
  const rows = (q.data ?? []).filter((r) => status === "all" || r.status === status || (status === "lead" && r.lead_id));
  return (
    <DataTable
      rows={rows}
      loading={q.isLoading}
      error={q.error}
      searchKeys={["title"]}
      toolbar={
        <select className="h-10 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar">
          <option value="all">Todas</option>
          <option value="open">Abiertas</option>
          <option value="handoff">Derivadas al equipo</option>
          <option value="lead">Con lead</option>
          <option value="blocked">Bloqueadas</option>
        </select>
      }
      columns={[
        { key: "title", label: "Conversación", render: (r) => <Link to={`/admin/nova/conversaciones/${r.id}`} className="font-medium hover:underline">{r.title || "(sin mensajes)"}</Link> },
        { key: "mode", label: "Modo", hideOnMobile: true, render: (r) => <Badge tone={r.mode === "ai" ? "violet" : "neutral"}>{r.mode === "ai" ? "IA" : "Guiado"}</Badge> },
        { key: "status", label: "Estado", render: (r) => <Badge tone={r.status === "handoff" ? "warning" : r.status === "blocked" ? "danger" : "neutral"}>{{ open: "Abierta", closed: "Cerrada", handoff: "Derivada", blocked: "Bloqueada" }[r.status] ?? r.status}</Badge> },
        { key: "lead", label: "Lead", render: (r) => (r.lead_id ? <Link to={`/admin/crm/${r.lead_id}`} className="text-lavender underline">Ver lead</Link> : <span className="text-muted">—</span>) },
        { key: "message_count", label: "Mensajes", hideOnMobile: true, sortValue: (r) => r.message_count },
        { key: "last_message_at", label: "Última actividad", sortValue: (r) => r.last_message_at, render: (r) => <span className="text-muted">{timeAgo(r.last_message_at)}</span> },
      ]}
      onRowClick={(r) => navigate(`/admin/nova/conversaciones/${r.id}`)}
    />
  );
}

export function ConversationView() {
  const { id = "" } = useParams();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "conversation", id],
    queryFn: async () => {
      const [c, m] = await Promise.all([
        supabase.from("conversations").select("*, quotes!conversations_quote_fk(reference, total_min, total_max, title)").eq("id", id).single(),
        supabase.from("messages").select("id, role, content, payload, created_at, tokens_in, tokens_out").eq("conversation_id", id).order("created_at"),
      ]);
      if (c.error) throw c.error;
      return { conv: c.data as ConvRow & { metadata: Record<string, unknown>; quotes: { reference: string; total_min: number; total_max: number; title: string } | null }, messages: m.data ?? [] };
    },
  });
  const setStatus = async (status: string) => {
    const { error } = await supabase.from("conversations").update({ status }).eq("id", id);
    if (error) toast("error", "No se pudo actualizar", errorMessage(error));
    else void qc.invalidateQueries({ queryKey: ["admin", "conversation", id] });
  };
  if (q.isLoading) return <AdminPage title="Conversación"><Skeleton className="h-96" /></AdminPage>;
  if (q.error || !q.data) return <AdminPage title="Conversación"><ErrorState error={q.error} /></AdminPage>;
  const { conv, messages } = q.data;
  return (
    <AdminPage
      title={conv.title || "Conversación"}
      description={`${formatDateTime(conv.created_at)} · ${conv.mode === "ai" ? "IA" : "Modo guiado"} · ${conv.tokens_in + conv.tokens_out} tokens`}
      actions={
        <>
          <Link to="/admin/nova" className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--tone-fg)]">
            <ArrowLeft className="size-4" /> Volver
          </Link>
          {conv.status !== "closed" && (
            <Button size="sm" variant="outline" onClick={() => void setStatus("closed")}>
              Cerrar
            </Button>
          )}
          {conv.status !== "blocked" ? (
            <Button size="sm" variant="ghost" className="text-danger" icon={<Ban className="size-4" />} onClick={() => void setStatus("blocked")}>
              Bloquear (abuso)
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => void setStatus("open")}>
              Desbloquear
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <ol className="space-y-4">
            {messages.map((m) =>
              m.role === "event" ? (
                <li key={m.id} className="text-center text-xs text-muted">
                  — {m.content} · {formatDateTime(m.created_at)} —
                </li>
              ) : (
                <li key={m.id} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-primary text-white" : "border border-tone bg-white/[0.05]")}>
                    <Markdown text={m.content || "—"} className="space-y-2 [&_ul]:list-disc [&_ul]:pl-4" />
                  </div>
                  <span className="text-[10px] text-muted">
                    {m.role === "user" ? "Usuario" : "Nova"} · {formatDateTime(m.created_at)}
                    {(m.payload as { quote_id?: string })?.quote_id ? " · presupuesto generado" : ""}
                    {(m.payload as { contact_request?: unknown })?.contact_request ? " · solicitud de contacto" : ""}
                  </span>
                </li>
              ),
            )}
          </ol>
        </Card>
        <div className="space-y-4">
          <Card title="Resumen">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Estado</dt>
                <dd>{conv.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Usuario</dt>
                <dd>{conv.user_id ? "Registrado" : "Anónimo"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Página de inicio</dt>
                <dd className="truncate">{String(conv.metadata?.page ?? "—")}</dd>
              </div>
            </dl>
          </Card>
          {conv.quotes && (
            <Card title="Presupuesto">
              <p className="text-sm">{conv.quotes.title}</p>
              <p className="mt-1 font-display text-lg">
                {money(conv.quotes.total_min)} – {money(conv.quotes.total_max)}
              </p>
              <p className="font-mono text-xs text-muted">{conv.quotes.reference}</p>
            </Card>
          )}
          <Card title="Lead">
            {conv.lead_id ? (
              <Link to={`/admin/crm/${conv.lead_id}`} className="inline-flex items-center gap-1.5 text-sm text-lavender underline">
                <MessageSquare className="size-4" /> Abrir en el CRM
              </Link>
            ) : (
              <p className="text-sm text-muted">El usuario no ha enviado sus datos.</p>
            )}
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
