import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { AdminPage, DataTable } from "../components/ui";

interface AuditRow {
  id: number;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  context: Record<string, unknown>;
  created_at: string;
}

const HIDDEN_KEYS = new Set(["updated_at", "created_at"]);

export default function AuditAdmin() {
  const [entity, setEntity] = useState("all");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const q = useQuery({
    queryKey: ["admin", "audit", entity],
    queryFn: async () => {
      let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      if (entity !== "all") query = query.eq("entity", entity);
      return ((await query).data ?? []) as AuditRow[];
    },
  });
  const diff = (r: AuditRow) => {
    const keys = [...new Set([...Object.keys(r.old_data ?? {}), ...Object.keys(r.new_data ?? {})])].filter((k) => !HIDDEN_KEYS.has(k) && JSON.stringify(r.old_data?.[k]) !== JSON.stringify(r.new_data?.[k]));
    return keys;
  };
  return (
    <AdminPage title="Auditoría" description="Registro inmutable de accesos administrativos y cambios en configuración, precios, Nova, permisos, contenido y clientes.">
      <DataTable
        rows={q.data}
        loading={q.isLoading}
        error={q.error}
        searchKeys={["actor_email", "action", "entity", "entity_id"]}
        onRowClick={setSelected}
        toolbar={
          <select className="h-10 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Entidad">
            <option value="all">Todas las entidades</option>
            {["admin", "user_roles", "role_permissions", "site_settings", "design_settings", "pricing_rules", "chatbot_settings", "chatbot_knowledge", "pages", "services", "coupons", "customers", "customer_projects", "leads", "privacy_requests", "profiles"].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        }
        columns={[
          { key: "created_at", label: "Fecha", render: (r) => formatDateTime(r.created_at) },
          { key: "actor_email", label: "Usuario", render: (r) => r.actor_email || <span className="text-muted">Sistema</span> },
          { key: "action", label: "Acción", render: (r) => <Badge tone={r.action === "delete" ? "danger" : r.action === "insert" ? "success" : "neutral"}>{r.action}</Badge> },
          { key: "entity", label: "Entidad" },
          { key: "changes", label: "Campos", hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{diff(r).slice(0, 5).join(", ")}</span> },
        ]}
      />
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Detalle del registro" width="max-w-3xl">
        {selected && (
          <div className="space-y-4 text-sm">
            <p>
              {formatDateTime(selected.created_at)} · {selected.actor_email ?? "Sistema"} · {selected.action} · {selected.entity} {selected.entity_id}
            </p>
            {Object.keys(selected.context ?? {}).length > 0 && <pre className="overflow-x-auto rounded-sm bg-white/5 p-3 text-xs">{JSON.stringify(selected.context, null, 2)}</pre>}
            <table className="w-full text-xs">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1 pr-3">Campo</th>
                  <th className="py-1 pr-3">Antes</th>
                  <th className="py-1">Después</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tone-line)] align-top">
                {diff(selected).map((k) => (
                  <tr key={k}>
                    <td className="py-1.5 pr-3 font-mono">{k}</td>
                    <td className="max-w-xs break-all py-1.5 pr-3 text-danger/90">{JSON.stringify(selected.old_data?.[k] ?? null)?.slice(0, 600)}</td>
                    <td className="max-w-xs break-all py-1.5 text-success">{JSON.stringify(selected.new_data?.[k] ?? null)?.slice(0, 600)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
    </AdminPage>
  );
}
