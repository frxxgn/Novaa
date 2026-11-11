import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/form";
import { Notice, Skeleton, useToast } from "@/components/ui/feedback";
import { AdminPage, Card, Tabs } from "../components/ui";
import { FormFields, type AdminField } from "../components/FormFields";
import { useSetting } from "../hooks";

const SECTIONS: Record<string, { label: string; key: string; description?: string; fields: AdminField[] }> = {
  empresa: {
    label: "Empresa",
    key: "company",
    description: "Se usan en el pie, los textos legales ({{company.legal_name}}…) y los datos estructurados.",
    fields: [
      { name: "name", label: "Nombre comercial", type: "text" },
      { name: "legal_name", label: "Razón social", type: "text" },
      { name: "tax_id", label: "NIF/CIF", type: "text" },
      { name: "address", label: "Dirección", type: "text" },
      { name: "tagline", label: "Lema", type: "text" },
      { name: "description", label: "Descripción breve", type: "textarea" },
    ],
  },
  contacto: {
    label: "Contacto",
    key: "contact",
    description: "Solo se muestran los canales completados. No publiques datos que no quieras hacer públicos.",
    fields: [
      { name: "email", label: "Correo", type: "email" },
      { name: "phone", label: "Teléfono", type: "text" },
      { name: "whatsapp", label: "WhatsApp (con prefijo, solo números)", type: "text", help: "Activa los botones «Continuar por WhatsApp», que abren la app con el mensaje preparado: el envío lo hace el visitante." },
      { name: "whatsapp_message", label: "Mensaje predefinido de WhatsApp", type: "textarea" },
      { name: "hours", label: "Horario", type: "text" },
    ],
  },
  redes: {
    label: "Redes sociales",
    key: "social",
    fields: ["instagram", "linkedin", "x", "youtube", "tiktok", "github"].map((k) => ({ name: k, label: k[0]!.toUpperCase() + k.slice(1), type: "text" as const, placeholder: "https://…" })),
  },
  marca: {
    label: "Marca",
    key: "branding",
    description: "Logotipos de la web. Déjalos vacíos para usar la identidad de Novalius incluida (vectorial y adaptable al diseño).",
    fields: [
      { name: "logo_dark_bg", label: "Logotipo para fondos oscuros", type: "image" },
      { name: "logo_light_bg", label: "Logotipo para fondos claros", type: "image" },
      { name: "mark", label: "Isotipo", type: "image" },
      { name: "favicon", label: "Favicon", type: "image" },
      { name: "nova_avatar", label: "Avatar de Nova", type: "image" },
    ],
  },
  seo: {
    label: "SEO",
    key: "seo_defaults",
    fields: [
      { name: "site_url", label: "URL pública (dominio)", type: "text", help: "Se usa en canonical, sitemap y Open Graph. Ej.: https://www.novalius.es" },
      { name: "title_template", label: "Plantilla de título", type: "text", help: "%s se sustituye por el título de cada página." },
      { name: "default_title", label: "Título por defecto", type: "text" },
      { name: "description", label: "Descripción por defecto", type: "textarea" },
      { name: "og_image", label: "Imagen para redes", type: "image" },
      { name: "twitter_handle", label: "Usuario de X", type: "text" },
    ],
  },
  cookies: {
    label: "Cookies",
    key: "cookies",
    description: "Al cambiar la versión se vuelve a pedir el consentimiento a todos los visitantes.",
    fields: [
      { name: "version", label: "Versión", type: "text" },
      { name: "banner_title", label: "Título del aviso", type: "text" },
      { name: "banner_text", label: "Texto del aviso", type: "textarea" },
    ],
  },
  privacidad: {
    label: "Privacidad",
    key: "privacy",
    fields: [
      { name: "consent_version", label: "Versión de la política (se guarda con cada consentimiento)", type: "text" },
      { name: "conversation_retention_days", label: "Conservar conversaciones sin lead (días)", type: "number", min: 30, max: 3650 },
      { name: "analytics_retention_days", label: "Conservar analíticas (días)", type: "number", min: 30, max: 3650 },
      { name: "lead_retention_note", label: "Nota sobre conservación de leads", type: "textarea" },
    ],
  },
  seguridad: {
    label: "Seguridad",
    key: "security",
    description: "Límites de uso por IP para proteger la API frente a abusos.",
    fields: [
      { name: "nova_per_minute", label: "Mensajes a Nova por minuto", type: "number", min: 1, max: 120 },
      { name: "nova_per_day", label: "Mensajes a Nova por día", type: "number", min: 10, max: 5000 },
      { name: "leads_per_hour", label: "Formularios por hora", type: "number", min: 1, max: 100 },
      { name: "quotes_per_hour", label: "Presupuestos por hora", type: "number", min: 1, max: 500 },
      { name: "games_per_minute", label: "Acciones de juego por minuto", type: "number", min: 10, max: 600 },
      { name: "analytics_per_minute", label: "Eventos de analítica por minuto", type: "number", min: 10, max: 1000 },
    ],
  },
  estado: {
    label: "Estado de la web",
    key: "site_status",
    description: "En modo mantenimiento los visitantes ven un aviso; el equipo sigue viendo la web.",
    fields: [
      { name: "maintenance", label: "Modo mantenimiento", type: "switch" },
      { name: "message", label: "Mensaje", type: "textarea" },
    ],
  },
};

export default function SettingsAdmin() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "empresa";
  const items = [...Object.entries(SECTIONS).map(([value, s]) => ({ value, label: s.label })), { value: "idiomas", label: "Idiomas" }, { value: "integraciones", label: "Integraciones" }, { value: "copias", label: "Copias de seguridad" }];
  return (
    <AdminPage title="Configuración" description="Ajustes globales de la plataforma. Todos los cambios quedan registrados en la auditoría." tabs={<Tabs value={tab} onChange={(v) => setParams({ tab: v })} items={items} />}>
      {SECTIONS[tab] && <SettingForm key={tab} section={SECTIONS[tab]!} />}
      {tab === "idiomas" && <Locales />}
      {tab === "integraciones" && <Integrations />}
      {tab === "copias" && <Backups />}
    </AdminPage>
  );
}

function SettingForm({ section }: { section: (typeof SECTIONS)[string] }) {
  const { query, save } = useSetting(section.key, {} as Record<string, unknown>);
  const [v, setV] = useState<Record<string, unknown> | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (query.data) setV(query.data);
  }, [query.data]);
  if (!v) return <Skeleton className="h-64" />;
  return (
    <Card title={section.label} description={section.description}>
      <FormFields fields={section.fields} value={v} onChange={setV} />
      <div className="mt-5 flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => save.mutate(v)}>
          Guardar
        </Button>
        {section.key === "privacy" && (
          <Button
            variant="outline"
            onClick={async () => {
              const { data, error } = await supabase.rpc("apply_retention");
              if (error) toast("error", "No se pudo aplicar", errorMessage(error));
              else toast("success", "Retención aplicada", `Conversaciones eliminadas: ${(data as { conversations_deleted: number }).conversations_deleted} · eventos: ${(data as { analytics_deleted: number }).analytics_deleted}`);
            }}
          >
            Aplicar retención ahora
          </Button>
        )}
      </div>
    </Card>
  );
}

function Locales() {
  const { query, save } = useSetting("locales", { default: "es", enabled: ["es"], available: ["es", "en"] } as Record<string, unknown>);
  const [enabled, setEnabled] = useState<string[]>([]);
  useEffect(() => {
    if (query.data) setEnabled((query.data.enabled as string[]) ?? ["es"]);
  }, [query.data]);
  if (!query.data) return <Skeleton className="h-40" />;
  return (
    <Card title="Idiomas" description="El español es el idioma base. Al activar el inglés aparece el selector de idioma; los textos sin traducir se muestran en español.">
      <div className="space-y-3">
        <Checkbox checked label="Español (base)" onChange={() => undefined} disabled />
        <Checkbox checked={enabled.includes("en")} label="Inglés" onChange={(v) => setEnabled(v ? ["es", "en"] : ["es"])} />
      </div>
      <Button className="mt-5" loading={save.isPending} onClick={() => save.mutate({ ...query.data, enabled })}>
        Guardar
      </Button>
    </Card>
  );
}

function Integrations() {
  const q = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => api<Record<string, { connected: boolean; provider?: string | null; missing: string[]; mode?: string } | string>>("/admin/integrations") });
  if (!q.data) return <Skeleton className="h-64" />;
  const rows: [string, string, string][] = [
    ["supabase", "Base de datos, autenticación y archivos", "Supabase"],
    ["ai", "Inteligencia artificial de Nova", "Anthropic (Claude)"],
    ["email", "Correo transaccional y avisos", "SMTP o Resend"],
    ["whatsapp", "Avisos por WhatsApp", "WhatsApp Business Cloud API"],
  ];
  return (
    <div className="space-y-4">
      <Notice tone="info">Las claves se configuran como variables de entorno del servidor (Vercel → Settings → Environment Variables). Nunca se guardan en la base de datos ni se envían al navegador. Consulta README.md · «Integraciones».</Notice>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(([key, label, provider]) => {
          const info = q.data[key] as { connected: boolean; missing: string[]; mode?: string; provider?: string | null };
          return (
            <Card key={key} title={label} description={provider}>
              <p className="flex items-center gap-2 text-sm">
                {info.connected ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-warning" />}
                {info.connected ? "Conectado" : "Sin configurar"}
                {info.mode ? ` · ${info.mode}` : ""}
              </p>
              {!info.connected && info.missing.length > 0 && <p className="mt-2 text-xs text-muted">Variables pendientes: {info.missing.join(", ")}</p>}
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted">URL configurada en el servidor: {String(q.data.site_url)}</p>
    </div>
  );
}

function Backups() {
  return (
    <Card title="Copias de seguridad">
      <div className="space-y-3 text-sm text-muted">
        <p>La base de datos y los archivos se alojan en Supabase. Las copias diarias automáticas dependen del plan contratado (el plan Pro incluye copias diarias y la opción de recuperación a un momento concreto, PITR).</p>
        <p>Recomendación: activa PITR en producción y exporta periódicamente un volcado con <code>supabase db dump</code> a un almacenamiento externo. El procedimiento completo está en README.md · «Copias de seguridad».</p>
        <p>Las versiones de páginas y de diseño se conservan en la propia base de datos y pueden restaurarse desde sus editores.</p>
      </div>
    </Card>
  );
}
