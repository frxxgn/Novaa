import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Save } from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { COMPLEXITY_LEVELS, DESIGN_LEVELS, FEATURE_KEYS, FEATURE_LABELS, MAINTENANCE_PLANS, PROJECT_TYPE_LABELS, PROJECT_TYPES, TIMELINES, type QuoteResult } from "@/shared/pricing";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { Badge, Notice, Skeleton, useToast } from "@/components/ui/feedback";
import { QuoteCard } from "@/features/nova/QuoteCard";
import { AdminPage, Card, DataTable, Tabs } from "../components/ui";
import { FormFields } from "../components/FormFields";
import { ResourceManager } from "../components/ResourceManager";
import { useSetting } from "../hooks";

interface Rule {
  id: string;
  key: string;
  category: string;
  label: string;
  description: string;
  unit: string;
  min_amount: number;
  max_amount: number;
  value: number;
  applies_to: string[];
  is_active: boolean;
  position: number;
}

const CATEGORY: Record<string, string> = {
  base: "Tarifas base por tipo de proyecto",
  page: "Páginas",
  design: "Diseño",
  feature: "Funcionalidades",
  complexity: "Complejidad",
  timeline: "Plazo",
  maintenance: "Mantenimiento mensual",
  margin: "Márgenes",
  limit: "Límites",
  discount: "Descuentos",
};
const UNIT: Record<string, string> = { fixed: "Importe fijo", per_unit: "Por unidad", multiplier: "Multiplicador", percent: "Porcentaje", monthly: "Mensual" };

export default function PricingAdmin() {
  const [tab, setTab] = useState<"rules" | "settings" | "simulator" | "references" | "history">("rules");
  const { can } = useAuth();
  return (
    <AdminPage
      title="Tarifas y presupuestos"
      description="Reglas con las que el servidor calcula los presupuestos orientativos de Nova y de la web. Nova no puede modificarlas."
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "rules", label: "Reglas" },
            { value: "settings", label: "Presentación" },
            { value: "simulator", label: "Simulador" },
            { value: "references", label: "Referencias de mercado" },
            ...(can("audit.read") ? [{ value: "history" as const, label: "Historial" }] : []),
          ]}
        />
      }
    >
      {tab === "rules" && <RulesEditor />}
      {tab === "settings" && <PricingSettings />}
      {tab === "simulator" && <Simulator />}
      {tab === "references" && (
        <>
          <Notice tone="info" className="mb-4">
            Registra aquí solo referencias reales que hayas consultado, con su fuente y fecha. Nova las muestra junto a la estimación del mismo tipo de proyecto. No se hace scraping ni se inventan precios de competidores.
          </Notice>
          <ResourceManager
            config={{
              table: "pricing_references",
              permission: "pricing.manage",
              title: "Referencias",
              singular: "referencia",
              orderBy: [{ column: "retrieved_at", ascending: false }],
              searchKeys: ["source_name", "project_type", "summary"],
              visibilityField: "is_active",
              defaults: { source_name: "", source_url: "", retrieved_at: new Date().toISOString().slice(0, 10), project_type: "web", min_amount: null, max_amount: null, summary: "", is_active: true },
              columns: [
                { key: "source_name", label: "Fuente", render: (r) => <span className="font-medium">{String(r.source_name)}</span> },
                { key: "project_type", label: "Tipo", render: (r) => PROJECT_TYPE_LABELS[r.project_type as keyof typeof PROJECT_TYPE_LABELS] ?? String(r.project_type) },
                { key: "retrieved_at", label: "Consultada", render: (r) => String(r.retrieved_at) },
              ],
              fields: [
                { name: "source_name", label: "Nombre de la fuente", type: "text", required: true },
                { name: "source_url", label: "URL de la fuente", type: "text" },
                { name: "retrieved_at", label: "Fecha de consulta", type: "date", required: true },
                { name: "project_type", label: "Tipo de proyecto", type: "select", options: PROJECT_TYPES.map((p) => ({ value: p, label: PROJECT_TYPE_LABELS[p] })) },
                { name: "min_amount", label: "Importe mínimo (€)", type: "number" },
                { name: "max_amount", label: "Importe máximo (€)", type: "number" },
                { name: "summary", label: "Resumen", type: "textarea" },
                { name: "is_active", label: "Activa", type: "switch" },
              ],
              emptyText: "Sin referencias de mercado registradas",
            }}
          />
        </>
      )}
      {tab === "history" && <PricingHistory />}
    </AdminPage>
  );
}

function RulesEditor() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "pricing_rules"], queryFn: async () => ((await supabase.from("pricing_rules").select("*").order("category").order("position")).data ?? []) as Rule[] });
  const [edits, setEdits] = useState<Record<string, Partial<Rule>>>({});
  const grouped = useMemo(() => {
    const m = new Map<string, Rule[]>();
    for (const r of q.data ?? []) m.set(r.category, [...(m.get(r.category) ?? []), r]);
    return [...m.entries()].sort((a, b) => Object.keys(CATEGORY).indexOf(a[0]) - Object.keys(CATEGORY).indexOf(b[0]));
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      for (const [id, patch] of Object.entries(edits)) {
        const { error } = await supabase.from("pricing_rules").update(patch).eq("id", id);
        if (error) throw error;
      }
      await api("/admin/cache/clear", { body: {} }).catch(() => undefined);
    },
    onSuccess: () => {
      setEdits({});
      toast("success", "Tarifas actualizadas", "Los siguientes presupuestos usarán los nuevos valores.");
      void qc.invalidateQueries({ queryKey: ["admin", "pricing_rules"] });
    },
    onError: (e) => toast("error", "No se pudieron guardar", errorMessage(e)),
  });

  const val = (r: Rule, k: keyof Rule) => (edits[r.id]?.[k] ?? r[k]) as number | boolean;
  const set = (r: Rule, k: keyof Rule, v: number | boolean) => setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], [k]: v } }));

  if (q.isLoading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-10 flex items-center justify-between gap-3 rounded-md border border-tone px-4 py-3 backdrop-blur" style={{ background: "color-mix(in oklab, var(--nv-surface-dark) 90%, transparent)" }}>
        <p className="text-sm text-muted">{Object.keys(edits).length ? `${Object.keys(edits).length} reglas modificadas` : "Edita los importes directamente en la tabla. Todos los cambios quedan auditados."}</p>
        <Button size="sm" icon={<Save className="size-4" />} disabled={!Object.keys(edits).length} loading={save.isPending} onClick={() => save.mutate()}>
          Guardar cambios
        </Button>
      </div>
      {grouped.map(([cat, rules]) => (
        <Card key={cat} title={CATEGORY[cat] ?? cat}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Regla</th>
                  <th className="py-2 pr-3 font-medium">Unidad</th>
                  <th className="py-2 pr-3 font-medium">Mín. (€)</th>
                  <th className="py-2 pr-3 font-medium">Máx. (€)</th>
                  <th className="py-2 pr-3 font-medium">Valor</th>
                  <th className="py-2 font-medium">Activa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tone-line)]">
                {rules.map((r) => {
                  const money = r.unit === "fixed" || r.unit === "per_unit" || r.unit === "monthly";
                  return (
                    <tr key={r.id} className={edits[r.id] ? "bg-warning/5" : ""}>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{r.label}</p>
                        <p className="text-xs text-muted">{r.description}</p>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted">{UNIT[r.unit]}</td>
                      <td className="py-2 pr-3">{money ? <NumberCell value={val(r, "min_amount") as number} onChange={(v) => set(r, "min_amount", v)} label={`Mínimo de ${r.label}`} /> : <span className="text-muted">—</span>}</td>
                      <td className="py-2 pr-3">{money ? <NumberCell value={val(r, "max_amount") as number} onChange={(v) => set(r, "max_amount", v)} label={`Máximo de ${r.label}`} /> : <span className="text-muted">—</span>}</td>
                      <td className="py-2 pr-3">{!money ? <NumberCell value={val(r, "value") as number} step={0.01} onChange={(v) => set(r, "value", v)} label={`Valor de ${r.label}`} suffix={r.unit === "percent" ? `= ${Math.round((val(r, "value") as number) * 100)} %` : "×"} /> : <span className="text-muted">—</span>}</td>
                      <td className="py-2">
                        <input type="checkbox" className="size-4 accent-[var(--nv-primary)]" checked={Boolean(val(r, "is_active"))} onChange={(e) => set(r, "is_active", e.target.checked)} aria-label={`Activar ${r.label}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function NumberCell({ value, onChange, step = 1, label, suffix }: { value: number; onChange: (v: number) => void; step?: number; label: string; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="number" step={step} min={0} className="h-9 w-24 rounded-sm border border-tone bg-white/[0.04] px-2 text-right font-mono text-sm" value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      {suffix && <span className="text-xs text-muted">{suffix}</span>}
    </span>
  );
}

function PricingSettings() {
  const { query, save } = useSetting("pricing", { currency: "EUR", vat_note: "", rounding: 50, valid_days: 30, reviewed: false, disclaimer: "" } as Record<string, unknown>);
  const [v, setV] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (query.data) setV(query.data);
  }, [query.data]);
  if (!v) return <Skeleton className="h-64" />;
  return (
    <Card title="Presentación de los presupuestos">
      {!v.reviewed && <Notice tone="warning" className="mb-4">Las tarifas actuales son valores iniciales. Revísalas y marca «Tarifas revisadas» para quitar el aviso en las estimaciones.</Notice>}
      <FormFields
        fields={[
          { name: "disclaimer", label: "Aviso legal de la estimación", type: "textarea" },
          { name: "vat_note", label: "Nota de impuestos", type: "text" },
          { name: "currency", label: "Moneda", type: "select", options: [{ value: "EUR", label: "Euro (EUR)" }] },
          { name: "rounding", label: "Redondeo (€)", type: "number", min: 1, max: 1000 },
          { name: "valid_days", label: "Validez (días)", type: "number", min: 1, max: 365 },
          { name: "reviewed", label: "Tarifas revisadas por el equipo", type: "switch" },
        ]}
        value={v}
        onChange={setV}
      />
      <Button className="mt-5" loading={save.isPending} onClick={() => save.mutate(v)}>
        Guardar
      </Button>
    </Card>
  );
}

function Simulator() {
  const toast = useToast();
  const [form, setForm] = useState({ project_type: "web", pages: 5, design: "custom", features: [] as string[], complexity: "medium", timeline: "standard", maintenance: "none", integration: 0, automation: 0 });
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const r = await api<{ quote: QuoteResult }>("/admin/pricing/simulate", {
        body: { project_type: form.project_type, pages: form.pages, design: form.design, features: form.features, complexity: form.complexity, timeline: form.timeline, maintenance: form.maintenance, quantities: { integration: form.integration || undefined, automation: form.automation || undefined } },
      });
      setResult(r.quote);
    } catch (e) {
      toast("error", "No se pudo calcular", errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <Card title="Requisitos" description="Simula un presupuesto con las reglas guardadas. No se registra nada.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo de proyecto" value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} options={PROJECT_TYPES.map((p) => ({ value: p, label: PROJECT_TYPE_LABELS[p] }))} />
          <Input label="Páginas" type="number" min={0} value={form.pages} onChange={(e) => setForm({ ...form, pages: Number(e.target.value) })} />
          <Select label="Diseño" value={form.design} onChange={(e) => setForm({ ...form, design: e.target.value })} options={DESIGN_LEVELS.map((d) => ({ value: d, label: { template: "Plantilla", custom: "A medida", premium: "Premium" }[d] }))} />
          <Select label="Complejidad" value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value })} options={COMPLEXITY_LEVELS.map((d) => ({ value: d, label: { low: "Baja", medium: "Media", high: "Alta" }[d] }))} />
          <Select label="Plazo" value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} options={TIMELINES.map((d) => ({ value: d, label: { flexible: "Flexible", standard: "Estándar", rush: "Urgente" }[d] }))} />
          <Select label="Mantenimiento" value={form.maintenance} onChange={(e) => setForm({ ...form, maintenance: e.target.value })} options={MAINTENANCE_PLANS.map((d) => ({ value: d, label: { none: "Sin mantenimiento", basic: "Básico", pro: "Profesional", ai: "Con IA" }[d] }))} />
          <Input label="Integraciones" type="number" min={0} value={form.integration} onChange={(e) => setForm({ ...form, integration: Number(e.target.value) })} />
          <Input label="Automatizaciones" type="number" min={0} value={form.automation} onChange={(e) => setForm({ ...form, automation: Number(e.target.value) })} />
        </div>
        <p className="mb-2 mt-5 text-sm font-medium">Funcionalidades</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURE_KEYS.map((f) => (
            <Checkbox key={f} label={FEATURE_LABELS[f]} checked={form.features.includes(f)} onChange={(v) => setForm({ ...form, features: v ? [...form.features, f] : form.features.filter((x) => x !== f) })} />
          ))}
        </div>
        <Button className="mt-6" icon={<Calculator className="size-4" />} loading={loading} onClick={() => void run()}>
          Calcular
        </Button>
      </Card>
      <div>{result ? <QuoteCard quote={{ ...result, id: "simulacion", reference: "SIMULACIÓN", created_at: "", valid_until: null }} /> : <p className="text-sm text-muted">El resultado aparecerá aquí.</p>}</div>
    </div>
  );
}

function PricingHistory() {
  const q = useQuery({
    queryKey: ["admin", "pricing-history"],
    queryFn: async () => ((await supabase.from("audit_logs").select("id, actor_email, action, entity, old_data, new_data, created_at").in("entity", ["pricing_rules", "pricing_references"]).order("created_at", { ascending: false }).limit(200)).data ?? []) as { id: number; actor_email: string | null; action: string; entity: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string }[],
  });
  return (
    <DataTable
      rows={q.data}
      loading={q.isLoading}
      columns={[
        { key: "created_at", label: "Fecha", render: (r) => formatDateTime(r.created_at) },
        { key: "actor_email", label: "Usuario", render: (r) => r.actor_email || "Sistema (carga inicial)" },
        { key: "rule", label: "Regla", render: (r) => String(r.new_data?.label ?? r.old_data?.label ?? r.new_data?.source_name ?? "—") },
        {
          key: "change",
          label: "Cambio",
          render: (r) => {
            if (r.action !== "update") return <Badge tone={r.action === "insert" ? "success" : "danger"}>{r.action === "insert" ? "Creada" : "Eliminada"}</Badge>;
            const keys = ["min_amount", "max_amount", "value", "is_active"].filter((k) => JSON.stringify(r.old_data?.[k]) !== JSON.stringify(r.new_data?.[k]));
            return <span className="text-xs">{keys.map((k) => `${k}: ${String(r.old_data?.[k])} → ${String(r.new_data?.[k])}`).join(" · ") || "—"}</span>;
          },
        },
      ]}
    />
  );
}
