import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/form";
import { Badge, Notice, Skeleton, useToast } from "@/components/ui/feedback";
import { AdminPage, Card, DataTable } from "../components/ui";
import { FormFields } from "../components/FormFields";
import { useSetting } from "../hooks";

interface NotifSettings extends Record<string, unknown> {
  email: { enabled: boolean; recipients: string[] };
  whatsapp: { enabled: boolean; recipient: string; template: string };
  internal: { enabled: boolean };
  events: Record<string, boolean>;
}

const EVENTS: [string, string][] = [
  ["new_lead", "Nuevo lead (formulario, Nova, plantilla)"],
  ["proposal_requested", "Propuesta solicitada desde un presupuesto"],
  ["handoff", "Nova deriva una conversación al equipo"],
  ["coupon_won", "Un usuario gana un cupón"],
  ["privacy_request", "Solicitud de privacidad"],
];

export default function NotificationsAdmin() {
  const toast = useToast();
  const { query, save } = useSetting<NotifSettings>("notifications", { email: { enabled: true, recipients: [] }, whatsapp: { enabled: false, recipient: "", template: "" }, internal: { enabled: true }, events: {} });
  const [v, setV] = useState<NotifSettings | null>(null);
  const integrations = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => api<{ email: { connected: boolean; provider: string | null; missing: string[] }; whatsapp: { connected: boolean; missing: string[] } }>("/admin/integrations") });
  const log = useQuery({ queryKey: ["admin", "deliveries"], queryFn: async () => ((await supabase.from("notification_deliveries").select("*").order("created_at", { ascending: false }).limit(200)).data ?? []) as { id: string; event: string; channel: string; recipient: string; status: string; provider: string; detail: string; created_at: string }[] });
  useEffect(() => {
    if (query.data) setV(query.data);
  }, [query.data]);
  const test = useMutation({
    mutationFn: () => api<{ results: { channel: string; status: string; detail: string }[] }>("/admin/notifications/test", { body: {} }),
    onSuccess: (r) => {
      toast("info", "Prueba ejecutada", r.results.map((x) => `${x.channel}: ${x.status} (${x.detail})`).join(" · "));
      void log.refetch();
    },
    onError: (e) => toast("error", "No se pudo enviar la prueba", errorMessage(e)),
  });
  if (!v) return <AdminPage title="Notificaciones"><Skeleton className="h-96" /></AdminPage>;
  const i = integrations.data;
  return (
    <AdminPage
      title="Notificaciones"
      description="Avisos al equipo por correo, WhatsApp y dentro del panel. Cada intento queda registrado con su resultado real."
      actions={
        <Button size="sm" variant="outline" icon={<Send className="size-4" />} loading={test.isPending} onClick={() => test.mutate()}>
          Enviar prueba
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Correo electrónico">
          {i && !i.email.connected && <Notice tone="warning" className="mb-4">Proveedor de correo no configurado en el servidor ({i.email.missing.join(", ")}). Los envíos se registrarán como «omitidos».</Notice>}
          {i?.email.connected && <p className="mb-4 text-xs text-muted">Proveedor: {i.email.provider}</p>}
          <Switch label="Enviar avisos por correo" checked={v.email.enabled} onChange={(x) => setV({ ...v, email: { ...v.email, enabled: x } })} />
          <div className="mt-4">
            <FormFields compact fields={[{ name: "recipients", label: "Destinatarios", type: "strings" }]} value={v.email as unknown as Record<string, unknown>} onChange={(x) => setV({ ...v, email: { ...v.email, recipients: (x.recipients as string[]) ?? [] } })} />
          </div>
        </Card>
        <Card title="WhatsApp (Cloud API de Meta)">
          {i && !i.whatsapp.connected && (
            <Notice tone="info" className="mb-4">
              No configurado. Necesitas una cuenta de WhatsApp Business, un número verificado, una plantilla aprobada por Meta y las variables {i.whatsapp.missing.join(", ")}. Meta cobra por conversación según su tarifa vigente.
            </Notice>
          )}
          <Switch label="Enviar avisos por WhatsApp" checked={v.whatsapp.enabled} onChange={(x) => setV({ ...v, whatsapp: { ...v.whatsapp, enabled: x } })} />
          <div className="mt-4">
            <FormFields compact fields={[{ name: "recipient", label: "Número destino (con prefijo, p. ej. 34600000000)", type: "text" }, { name: "template", label: "Nombre de la plantilla aprobada", type: "text" }]} value={v.whatsapp as unknown as Record<string, unknown>} onChange={(x) => setV({ ...v, whatsapp: { ...v.whatsapp, ...(x as Partial<NotifSettings["whatsapp"]>) } })} />
          </div>
        </Card>
        <Card title="Panel">
          <Switch label="Notificaciones internas" description="Se muestran en la campana del panel a los miembros con el permiso correspondiente." checked={v.internal.enabled} onChange={(x) => setV({ ...v, internal: { enabled: x } })} />
        </Card>
        <Card title="Eventos">
          <div className="space-y-3">
            {EVENTS.map(([k, label]) => (
              <Switch key={k} label={label} checked={v.events[k] !== false} onChange={(x) => setV({ ...v, events: { ...v.events, [k]: x } })} />
            ))}
          </div>
        </Card>
      </div>
      <Button className="mt-6" loading={save.isPending} onClick={() => save.mutate(v)}>
        Guardar
      </Button>
      <h2 className="mb-3 mt-10 font-display text-lg">Registro de entregas</h2>
      <DataTable
        rows={log.data}
        loading={log.isLoading}
        searchKeys={["event", "channel", "recipient", "detail"]}
        columns={[
          { key: "created_at", label: "Fecha", render: (r) => formatDateTime(r.created_at) },
          { key: "event", label: "Evento" },
          { key: "channel", label: "Canal" },
          { key: "status", label: "Resultado", render: (r) => <Badge tone={r.status === "sent" ? "success" : r.status === "failed" ? "danger" : "neutral"}>{{ sent: "Enviado", failed: "Error", skipped: "Omitido" }[r.status]}</Badge> },
          { key: "recipient", label: "Destino", hideOnMobile: true },
          { key: "detail", label: "Detalle", hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{r.detail}</span> },
        ]}
      />
    </AdminPage>
  );
}
