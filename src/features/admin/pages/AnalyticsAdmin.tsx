import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ErrorState, Notice, Skeleton } from "@/components/ui/feedback";
import { AdminPage, BarList, Card, LineChart, Stat, Tabs } from "../components/ui";

interface Summary {
  visits: number;
  pageviews: number;
  top_pages: { path: string; views: number }[];
  cta_clicks: { id: string; clicks: number }[];
  devices: Record<string, number>;
  referrers: { referrer: string; visits: number }[];
  conversations: number;
  quotes: number;
  forms: number;
  leads: number;
  won: number;
  games: Record<string, number>;
  game_wins: number;
  coupons_issued: number;
  coupons_used: number;
  daily: { day: string; visits: number; pageviews: number; leads: number }[];
}

export default function AnalyticsAdmin() {
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const q = useQuery({
    queryKey: ["admin", "analytics", range],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(Date.now() - (Number(range) - 1) * 86_400_000);
      from.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.rpc("analytics_summary", { p_from: from.toISOString(), p_to: to.toISOString() });
      if (error) throw error;
      return data as Summary;
    },
  });
  const d = q.data;
  const conv = d && d.visits ? ((d.leads / d.visits) * 100).toFixed(1) : null;
  return (
    <AdminPage
      title="Analíticas"
      description="Medición propia, sin cookies de terceros ni IP. Las visitas solo se registran cuando el visitante acepta las analíticas."
      actions={<Tabs value={range} onChange={setRange} items={[{ value: "7", label: "7 días" }, { value: "30", label: "30 días" }, { value: "90", label: "90 días" }]} />}
    >
      {q.error ? (
        <ErrorState error={q.error} />
      ) : !d ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Visitas" value={d.visits} hint={`${d.pageviews} páginas vistas`} />
            <Stat label="Conversaciones con Nova" value={d.conversations} />
            <Stat label="Presupuestos generados" value={d.quotes} />
            <Stat label="Formularios enviados" value={d.forms} />
            <Stat label="Leads captados" value={d.leads} hint={conv ? `${conv} % de las visitas medidas` : undefined} />
            <Stat label="Leads ganados" value={d.won} tone="success" />
            <Stat label="Partidas del Challenge" value={Object.values(d.games).reduce((a, b) => a + b, 0)} hint={`${d.game_wins} victorias`} />
            <Stat label="Cupones" value={`${d.coupons_issued} / ${d.coupons_used}`} hint="Generados / utilizados" />
          </div>
          <Card title="Evolución diaria">
            <LineChart data={d.daily} series={[{ key: "visits", label: "Visitas", color: "#c9b8f5" }, { key: "pageviews", label: "Páginas vistas", color: "#a540fb" }, { key: "leads", label: "Leads", color: "#15a36a" }]} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Páginas más visitadas">
              <BarList items={d.top_pages.map((p) => ({ label: p.path, value: p.views }))} />
            </Card>
            <Card title="Clics en llamadas a la acción">
              <BarList items={d.cta_clicks.map((c) => ({ label: c.id, value: c.clicks }))} color="var(--nv-secondary)" />
            </Card>
            <Card title="Dispositivos">
              <BarList items={Object.entries(d.devices).map(([k, v]) => ({ label: { mobile: "Móvil", tablet: "Tablet", desktop: "Escritorio" }[k] ?? k, value: v }))} color="#2f6fe4" />
            </Card>
            <Card title="Sitios de referencia">
              <BarList items={d.referrers.map((r) => ({ label: r.referrer, value: r.visits }))} color="#15a36a" />
            </Card>
          </div>
          <Notice tone="info">Las cifras de visitas son inferiores a las reales porque solo se miden las sesiones con consentimiento. Leads, presupuestos y conversaciones se cuentan siempre (son datos operativos).</Notice>
        </div>
      )}
    </AdminPage>
  );
}
