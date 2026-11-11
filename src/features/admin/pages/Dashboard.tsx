import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Bot, FolderKanban, Receipt, Ticket, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { money, timeAgo } from "@/lib/utils";
import { Badge, ErrorState, Notice, Skeleton } from "@/components/ui/feedback";
import { AdminPage, BarList, Card, LineChart, Stat, Tabs } from "../components/ui";

interface DashboardData {
  leads_total: number;
  leads_new: number;
  leads_period: number;
  leads_by_status: Record<string, number>;
  leads_by_source: Record<string, number>;
  won: number;
  lost: number;
  pipeline_min: number;
  pipeline_max: number;
  users_total: number;
  users_period: number;
  customers_total: number;
  quotes_period: number;
  proposals_requested: number;
  projects_active: number;
  projects_completed: number;
  conversations_period: number;
  messages_period: number;
  visits_period: number;
  pageviews_period: number;
  games_period: number;
  coupons_issued: number;
  coupons_used: number;
  series: { day: string; leads: number; conversations: number; visits: number; quotes: number }[];
  alerts: { stale_new_leads: number; unassigned_leads: number; overdue_projects: number; pending_privacy_requests: number; flagged_games: number };
}

export const STATUS_LABEL: Record<string, string> = { new: "Nuevo", contacted: "Contactado", negotiation: "Negociación", won: "Ganado", lost: "Perdido" };
export const SOURCE_LABEL: Record<string, string> = { nova: "Nova", contact_form: "Formulario", quote: "Presupuesto", template: "Plantilla", challenge: "Challenge", manual: "Manual" };

export default function Dashboard() {
  const { can } = useAuth();
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const q = useQuery({ queryKey: ["admin", "dashboard", days], queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_dashboard", { p_days: Number(days) });
    if (error) throw error;
    return data as DashboardData;
  } });
  const integrations = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => api<{ ai: { connected: boolean; mode: string }; email: { connected: boolean }; whatsapp: { connected: boolean } }>("/admin/integrations") });
  const pricing = useQuery({ queryKey: ["admin", "pricing-reviewed"], queryFn: async () => (await supabase.from("site_settings").select("value").eq("key", "pricing").maybeSingle()).data?.value as { reviewed?: boolean } | undefined, enabled: can("pricing.manage") });
  const activity = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: async () => {
      if (can("crm.read")) {
        const { data } = await supabase.from("lead_events").select("id, type, data, created_at, leads(id, name)").order("created_at", { ascending: false }).limit(12);
        return (data ?? []) as unknown as { id: number; type: string; data: Record<string, string>; created_at: string; leads: { id: string; name: string } | null }[];
      }
      return [];
    },
  });

  const d = q.data;
  const conversion = d && d.won + d.lost > 0 ? Math.round((d.won / (d.won + d.lost)) * 100) : null;

  return (
    <AdminPage
      title="Dashboard"
      description="Datos en tiempo real de la base de datos de Novalius."
      actions={<Tabs value={days} onChange={setDays} items={[{ value: "7", label: "7 días" }, { value: "30", label: "30 días" }, { value: "90", label: "90 días" }]} />}
    >
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            {integrations.data && !integrations.data.ai.connected && (
              <Notice tone="info">
                Nova funciona en <strong>modo guiado</strong> (sin IA conversacional). Configura <code>ANTHROPIC_API_KEY</code> en el servidor para activar la IA. <Link to="/admin/configuracion?tab=integraciones" className="underline">Ver integraciones</Link>
              </Notice>
            )}
            {integrations.data && !integrations.data.email.connected && (
              <Notice tone="warning">El correo no está configurado: las notificaciones solo se registran en el panel.</Notice>
            )}
            {pricing.data && pricing.data.reviewed === false && (
              <Notice tone="warning">
                Las tarifas de presupuesto son valores iniciales sin revisar. <Link to="/admin/tarifas" className="underline">Revisar tarifas</Link>
              </Notice>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Leads nuevos" value={d.leads_new} hint={`${d.leads_period} en el periodo · ${d.leads_total} en total`} icon={<Users className="size-4" />} />
            <Stat label="Presupuestos generados" value={d.quotes_period} hint={`${d.proposals_requested} propuestas solicitadas`} icon={<Receipt className="size-4" />} />
            <Stat label="Conversaciones con Nova" value={d.conversations_period} hint={`${d.messages_period} mensajes de usuarios`} icon={<Bot className="size-4" />} />
            <Stat label="Visitas" value={d.visits_period} hint={`${d.pageviews_period} páginas vistas (con consentimiento)`} icon={<ArrowUpRight className="size-4" />} />
            <Stat label="Clientes registrados" value={d.users_total} hint={`${d.users_period} nuevos · ${d.customers_total} clientes`} icon={<UserPlus className="size-4" />} />
            <Stat label="Proyectos activos" value={d.projects_active} hint={`${d.projects_completed} completados`} icon={<FolderKanban className="size-4" />} />
            <Stat label="Conversión de leads" value={conversion === null ? "—" : `${conversion} %`} hint={`${d.won} ganados · ${d.lost} perdidos`} tone="success" />
            <Stat label="Pipeline abierto" value={`${money(d.pipeline_min)} – ${money(d.pipeline_max)}`} hint="Suma de estimaciones de leads abiertos" icon={<Ticket className="size-4" />} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Card title="Evolución" description={`Últimos ${days} días`}>
              <LineChart
                data={d.series}
                series={[
                  { key: "visits", label: "Visitas", color: "#c9b8f5" },
                  { key: "conversations", label: "Conversaciones", color: "#a540fb" },
                  { key: "leads", label: "Leads", color: "#15a36a" },
                  { key: "quotes", label: "Presupuestos", color: "#2f6fe4" },
                ]}
              />
            </Card>
            <Card title="Alertas">
              <ul className="space-y-2 text-sm">
                {[
                  [d.alerts.stale_new_leads, "leads nuevos sin contactar (+24 h)", "/admin/crm"],
                  [d.alerts.unassigned_leads, "leads abiertos sin responsable", "/admin/crm"],
                  [d.alerts.overdue_projects, "proyectos con fecha vencida", "/admin/proyectos"],
                  [d.alerts.pending_privacy_requests, "solicitudes de privacidad pendientes", "/admin/usuarios"],
                  [d.alerts.flagged_games, "partidas marcadas como sospechosas", "/admin/challenge"],
                ].map(([n, label, to]) => (
                  <li key={label as string}>
                    <Link to={to as string} className="flex items-center justify-between gap-3 rounded-sm border border-tone px-3 py-2.5 hover:bg-white/5">
                      <span className="flex items-center gap-2">
                        {Number(n) > 0 && <AlertTriangle className="size-4 text-warning" />}
                        {label as string}
                      </span>
                      <Badge tone={Number(n) > 0 ? "warning" : "neutral"}>{n as number}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Leads por estado">
              <BarList items={Object.entries(STATUS_LABEL).map(([k, label]) => ({ label, value: d.leads_by_status[k] ?? 0 }))} />
            </Card>
            <Card title="Origen de los leads" description="Periodo seleccionado">
              <BarList items={Object.entries(d.leads_by_source).map(([k, v]) => ({ label: SOURCE_LABEL[k] ?? k, value: v }))} color="var(--nv-secondary)" />
            </Card>
            <Card title="Actividad reciente">
              {activity.data?.length ? (
                <ul className="space-y-3 text-sm">
                  {activity.data.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3">
                      <Link to={a.leads ? `/admin/crm/${a.leads.id}` : "#"} className="min-w-0 truncate hover:underline">
                        {a.type === "created" ? "Nuevo lead" : a.type === "status_changed" ? `Estado → ${STATUS_LABEL[a.data?.to ?? ""] ?? a.data?.to}` : a.type === "note" ? "Nota añadida" : a.type === "assigned" ? "Responsable asignado" : a.type === "converted" ? "Convertido en cliente" : "Actualizado"}
                        {a.leads ? ` · ${a.leads.name}` : ""}
                      </Link>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Sin actividad todavía.</p>
              )}
            </Card>
          </div>
          <p className="text-xs text-muted">
            Challenge: {d.games_period} partidas en el periodo · {d.coupons_issued} cupones emitidos · {d.coupons_used} utilizados.
          </p>
        </div>
      )}
    </AdminPage>
  );
}
