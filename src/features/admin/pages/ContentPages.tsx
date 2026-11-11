import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { PROJECT_TYPE_LABELS, PROJECT_TYPES } from "@/shared/pricing";
import { ICON_NAMES } from "@/components/ui/Icon";
import { Badge, useToast } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";
import { AdminPage, DataTable } from "../components/ui";
import { ResourceManager, type ResourceConfig } from "../components/ResourceManager";
import type { AdminField } from "../components/FormFields";

const VISUALS = ["layers", "grid", "flow", "chat", "dashboard", "data", "nodes", "shield", "refresh", "bubbles", "orbit"].map((v) => ({ value: v, label: v }));
const seoFields: AdminField = { name: "seo", label: "SEO (JSON: title, description, og_image, noindex)", type: "json" };
const i18nField: AdminField = { name: "i18n", label: "Traducciones (JSON por idioma, p. ej. {\"en\": {\"title\": \"…\"}})", type: "json" };

const RESOURCES: Record<string, { title: string; description: string; config: ResourceConfig }> = {
  servicios: {
    title: "Servicios",
    description: "Cada servicio genera su página /servicios/slug y aparece en el escaparate, el menú y el conocimiento de Nova.",
    config: {
      table: "services",
      permission: "content.manage",
      title: "Servicios",
      singular: "servicio",
      orderable: true,
      visibilityField: "is_published",
      slugFrom: "title",
      orderBy: [{ column: "position" }],
      searchKeys: ["title", "slug", "tagline"],
      defaults: { title: "", slug: "", tagline: "", summary: "", problem: "", benefits: [], features: [], examples: [], icon: "sparkles", visual: "orbit", accent: "", cta_label: "Solicitar presupuesto", project_type: "web", seo: {}, i18n: {}, is_published: false },
      columns: [
        { key: "title", label: "Servicio", render: (r) => <span className="font-medium">{String(r.title)}</span> },
        { key: "slug", label: "Ruta", hideOnMobile: true, render: (r) => <code className="text-xs text-muted">/servicios/{String(r.slug)}</code> },
        { key: "is_published", label: "Estado", render: (r) => <Badge tone={r.is_published ? "success" : "warning"}>{r.is_published ? "Publicado" : "Oculto"}</Badge> },
      ],
      rowActions: (r) => (
        <Link to={`/servicios/${String(r.slug)}`} target="_blank" className="rounded p-1.5 text-muted hover:bg-white/10" aria-label="Ver en la web">
          <ExternalLink className="size-4" />
        </Link>
      ),
      fields: [
        { name: "title", label: "Nombre", type: "text", required: true },
        { name: "slug", label: "Slug (URL)", type: "text", help: "Se genera a partir del nombre si lo dejas vacío." },
        { name: "tagline", label: "Frase corta", type: "text" },
        { name: "summary", label: "Descripción", type: "textarea" },
        { name: "problem", label: "Problema que resuelve", type: "textarea" },
        { name: "benefits", label: "Beneficios", type: "strings" },
        { name: "features", label: "Funcionalidades", type: "list", fields: [{ name: "title", label: "Título", type: "text" }, { name: "description", label: "Descripción", type: "textarea" }] },
        { name: "examples", label: "Ejemplos de aplicación", type: "strings" },
        { name: "icon", label: "Icono", type: "icon", options: ICON_NAMES.map((i) => ({ value: i, label: i })) },
        { name: "visual", label: "Ilustración", type: "select", options: VISUALS },
        { name: "accent", label: "Color de acento", type: "color" },
        { name: "project_type", label: "Tipo de proyecto (presupuestos)", type: "select", options: PROJECT_TYPES.map((p) => ({ value: p, label: PROJECT_TYPE_LABELS[p] })) },
        { name: "cta_label", label: "Texto del botón", type: "text" },
        { name: "is_published", label: "Publicado", type: "switch" },
        seoFields,
        i18nField,
      ],
    },
  },
  proyectos: {
    title: "Portfolio",
    description: "No publiques clientes ni resultados que no sean reales. Marca como «conceptual» cualquier demostración.",
    config: {
      table: "projects",
      permission: "content.manage",
      title: "Proyectos",
      singular: "proyecto",
      orderable: true,
      visibilityField: "is_published",
      slugFrom: "title",
      orderBy: [{ column: "position" }],
      searchKeys: ["title", "category", "client_label"],
      defaults: { title: "", slug: "", client_label: "Proyecto conceptual", is_concept: true, category: "", summary: "", challenge: "", solution: "", outcome: "", features: [], stack: [], cover_url: "", gallery: [], video_url: "", demo_url: "", accent: "#6c26e8", year: new Date().getFullYear(), seo: {}, i18n: {}, is_published: false },
      columns: [
        { key: "title", label: "Proyecto", render: (r) => <span className="font-medium">{String(r.title)}</span> },
        { key: "is_concept", label: "Tipo", render: (r) => <Badge tone={r.is_concept ? "warning" : "success"}>{r.is_concept ? "Conceptual" : String(r.client_label || "Real")}</Badge> },
        { key: "is_published", label: "Estado", hideOnMobile: true, render: (r) => <Badge tone={r.is_published ? "success" : "neutral"}>{r.is_published ? "Publicado" : "Oculto"}</Badge> },
      ],
      fields: [
        { name: "title", label: "Título", type: "text", required: true },
        { name: "slug", label: "Slug (URL)", type: "text" },
        { name: "is_concept", label: "Proyecto conceptual (demo)", type: "switch", help: "Actívalo si no corresponde a un cliente real." },
        { name: "client_label", label: "Etiqueta de cliente", type: "text", help: "Solo nombres reales con autorización del cliente." },
        { name: "category", label: "Categoría", type: "text" },
        { name: "year", label: "Año", type: "number", min: 2000, max: 2100 },
        { name: "summary", label: "Resumen", type: "textarea" },
        { name: "challenge", label: "Reto", type: "textarea" },
        { name: "solution", label: "Solución", type: "textarea" },
        { name: "outcome", label: "Resultado", type: "textarea", help: "No incluyas cifras que no puedas acreditar." },
        { name: "features", label: "Funcionalidades destacadas", type: "strings" },
        { name: "stack", label: "Tecnología", type: "strings" },
        { name: "cover_url", label: "Portada", type: "image", help: "Si se deja vacía se genera una portada abstracta." },
        { name: "video_url", label: "Vídeo", type: "image" },
        { name: "gallery", label: "Galería", type: "list", fields: [{ name: "url", label: "Archivo", type: "image" }, { name: "alt", label: "Texto alternativo", type: "text" }, { name: "kind", label: "Tipo", type: "select", options: [{ value: "image", label: "Imagen" }, { value: "video", label: "Vídeo" }] }] },
        { name: "demo_url", label: "Enlace a demo", type: "text" },
        { name: "accent", label: "Color de acento", type: "color" },
        { name: "is_published", label: "Publicado", type: "switch" },
        seoFields,
        i18nField,
      ],
    },
  },
  plantillas: {
    title: "Plantillas",
    description: "Demos funcionales por sector. El contenido de la demo se edita como JSON (marca, carta, horarios…) y el tema con colores.",
    config: {
      table: "templates",
      permission: "content.manage",
      title: "Plantillas",
      singular: "plantilla",
      orderable: true,
      visibilityField: "is_published",
      slugFrom: "name",
      orderBy: [{ column: "position" }],
      searchKeys: ["name", "category"],
      defaults: { name: "", slug: "", category: "", description: "", features: [], demo_key: "services", theme: { primary: "#6c26e8", accent: "#c9b8f5", bg: "#0b0d1a", surface: "#141733", text: "#eef0ff", font: "sans", layout: "split" }, content: { brand: "Negocio de ejemplo", tagline: "", hero: { title: "", subtitle: "", cta: "Contactar" }, nav: ["Servicios", "Proceso", "Reserva", "Contacto"], offer_title: "Servicios", categories: [], features: [], booking: { title: "Contacto", cta: "Enviar", kind: "contact" }, hours: [], contact: { address: "Dirección ficticia", phone: "" } }, screenshots: [], i18n: {}, is_published: false },
      columns: [
        { key: "name", label: "Plantilla", render: (r) => <span className="font-medium">{String(r.name)}</span> },
        { key: "category", label: "Sector" },
        { key: "is_published", label: "Estado", hideOnMobile: true, render: (r) => <Badge tone={r.is_published ? "success" : "neutral"}>{r.is_published ? "Publicada" : "Oculta"}</Badge> },
      ],
      rowActions: (r) => (
        <Link to={`/demo/${String(r.slug)}`} target="_blank" className="rounded p-1.5 text-muted hover:bg-white/10" aria-label="Abrir demo">
          <ExternalLink className="size-4" />
        </Link>
      ),
      fields: [
        { name: "name", label: "Nombre", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text" },
        { name: "category", label: "Sector", type: "text" },
        { name: "description", label: "Descripción", type: "textarea" },
        { name: "features", label: "Características", type: "strings" },
        { name: "demo_key", label: "Icono de sector", type: "select", options: ["restaurant", "barber", "clinic", "construction", "garage", "shop", "law", "services", "freelancer"].map((v) => ({ value: v, label: v })) },
        { name: "theme", label: "Tema (JSON: primary, accent, bg, surface, text, font serif|sans|condensed|display, layout editorial|split|centered)", type: "json" },
        { name: "content", label: "Contenido de la demo (JSON)", type: "json", help: "Usa siempre negocios y datos ficticios." },
        { name: "is_published", label: "Publicada", type: "switch" },
        i18nField,
      ],
    },
  },
  faq: {
    title: "Preguntas frecuentes",
    description: "FAQ generales, del Challenge, de la cuenta y por servicio.",
    config: {
      table: "faqs",
      permission: "content.manage",
      title: "Preguntas",
      singular: "pregunta",
      orderable: true,
      visibilityField: "is_published",
      orderBy: [{ column: "scope" }, { column: "position" }],
      searchKeys: ["question", "answer", "scope"],
      defaults: { scope: "general", service_id: null, question: "", answer: "", i18n: {}, is_published: true },
      columns: [
        { key: "question", label: "Pregunta", render: (r) => <span className="font-medium">{String(r.question)}</span> },
        { key: "scope", label: "Ámbito", render: (r) => <Badge tone="violet">{String(r.scope)}</Badge> },
      ],
      beforeSave: (r) => ({ ...r, service_id: r.scope === "service" ? r.service_id || null : null }),
      fields: [
        { name: "scope", label: "Ámbito", type: "select", options: [{ value: "general", label: "General" }, { value: "service", label: "Servicio" }, { value: "challenge", label: "Challenge" }, { value: "account", label: "Cuenta" }] },
        { name: "service_id", label: "Servicio", type: "select", options: [] },
        { name: "question", label: "Pregunta", type: "text", required: true },
        { name: "answer", label: "Respuesta", type: "textarea", required: true },
        { name: "is_published", label: "Publicada", type: "switch" },
        i18nField,
      ],
    },
  },
  navegacion: {
    title: "Navegación y pie de página",
    description: "Menú principal (el elemento marcado como CTA se muestra como botón), columnas del pie agrupadas y enlaces legales.",
    config: {
      table: "navigation_items",
      permission: "content.manage",
      title: "Enlaces",
      singular: "enlace",
      orderable: true,
      visibilityField: "is_visible",
      orderBy: [{ column: "menu" }, { column: "position" }],
      searchKeys: ["label", "href", "menu", "group_label"],
      defaults: { menu: "header", label: "", href: "/", group_label: "", is_visible: true, is_cta: false, i18n: {} },
      columns: [
        { key: "label", label: "Texto", render: (r) => <span className="font-medium">{String(r.label)}</span> },
        { key: "menu", label: "Menú", render: (r) => <Badge tone="violet">{{ header: "Cabecera", footer: "Pie", legal: "Legal", social: "Redes" }[String(r.menu)] ?? String(r.menu)}</Badge> },
        { key: "group_label", label: "Columna", hideOnMobile: true },
        { key: "href", label: "Enlace", hideOnMobile: true, render: (r) => <code className="text-xs text-muted">{String(r.href)}</code> },
      ],
      fields: [
        { name: "menu", label: "Menú", type: "select", options: [{ value: "header", label: "Cabecera" }, { value: "footer", label: "Pie" }, { value: "legal", label: "Legal" }] },
        { name: "label", label: "Texto", type: "text", required: true },
        { name: "href", label: "Enlace", type: "text", help: "Ruta interna (/contacto), ancla (#nova) o URL https." },
        { name: "group_label", label: "Columna del pie", type: "text" },
        { name: "is_cta", label: "Mostrar como botón (cabecera)", type: "switch" },
        { name: "is_visible", label: "Visible", type: "switch" },
        i18nField,
      ],
    },
  },
};

export default function ContentPages() {
  const { kind = "" } = useParams();
  const services = useQuery({ queryKey: ["admin", "services-options"], queryFn: async () => ((await supabase.from("services").select("id, title").order("position")).data ?? []) as { id: string; title: string }[], enabled: kind === "faq" });
  if (kind === "traducciones") return <TranslationsEditor />;
  const r = RESOURCES[kind];
  if (!r) return <AdminPage title="No encontrado">Sección desconocida.</AdminPage>;
  // Las FAQ de servicio se vinculan eligiendo el servicio de una lista
  const config: ResourceConfig =
    kind === "faq"
      ? { ...r.config, fields: r.config.fields.map((f) => (f.name === "service_id" ? { ...f, type: "select" as const, help: "Solo para el ámbito «Servicio».", options: (services.data ?? []).map((sv) => ({ value: sv.id, label: sv.title })) } : f)) }
      : r.config;
  return (
    <AdminPage title={r.title} description={r.description}>
      <ResourceManager key={kind} config={config} />
    </AdminPage>
  );
}

function TranslationsEditor() {
  const toast = useToast();
  const qc = useQueryClient();
  const [locale, setLocale] = useState<"es" | "en">("es");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ["admin", "translations"], queryFn: async () => ((await supabase.from("translations").select("key, locale, value")).data ?? []) as { key: string; locale: string; value: string }[] });
  const overrides = useMemo(() => Object.fromEntries((q.data ?? []).filter((t) => t.locale === locale).map((t) => [t.key, t.value])), [q.data, locale]);
  const rows = Object.keys(es).map((key) => ({ id: key, key, base: (locale === "en" ? en[key] : es[key]) ?? "", fallback: es[key] ?? "", value: edits[key] ?? overrides[key] ?? "" }));

  const save = useMutation({
    mutationFn: async () => {
      const upserts = Object.entries(edits).filter(([, v]) => v.trim()).map(([key, value]) => ({ key, locale, value: value.trim() }));
      const deletes = Object.entries(edits).filter(([, v]) => !v.trim()).map(([k]) => k);
      if (upserts.length) {
        const { error } = await supabase.from("translations").upsert(upserts);
        if (error) throw error;
      }
      if (deletes.length) {
        const { error } = await supabase.from("translations").delete().eq("locale", locale).in("key", deletes);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setEdits({});
      toast("success", "Traducciones guardadas");
      void qc.invalidateQueries({ queryKey: ["admin", "translations"] });
      void qc.invalidateQueries({ queryKey: ["site-bundle"] });
    },
    onError: (e) => toast("error", "No se pudo guardar", errorMessage(e)),
  });

  return (
    <AdminPage
      title="Traducciones"
      description="Textos de la interfaz. Deja una celda vacía para usar el texto por defecto. Para mostrar el inglés en la web, actívalo en Configuración · Idiomas. El contenido de páginas y servicios se traduce en su propio editor (campo i18n)."
      actions={
        <>
          <div className="flex rounded-full border border-tone p-0.5">
            {(["es", "en"] as const).map((l) => (
              <button key={l} onClick={() => { setLocale(l); setEdits({}); }} className={`rounded-full px-3 py-1 text-sm uppercase ${locale === l ? "bg-white text-ink" : "text-muted"}`}>
                {l}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!Object.keys(edits).length}>
            Guardar ({Object.keys(edits).length})
          </Button>
        </>
      }
    >
      <DataTable
        rows={rows}
        loading={q.isLoading}
        searchKeys={["key", "base", "value"]}
        pageSize={40}
        columns={[
          { key: "key", label: "Clave", render: (r) => <code className="text-xs text-muted">{r.key}</code> },
          { key: "base", label: locale === "en" ? "Por defecto (en / es)" : "Por defecto", render: (r) => <span className="text-muted">{r.base || <em>{r.fallback} (es)</em>}</span> },
          {
            key: "value",
            label: "Personalizado",
            render: (r) => <input className="h-9 w-full min-w-48 rounded-sm border border-tone bg-white/[0.04] px-2 text-sm" value={r.value} placeholder="—" onChange={(e) => setEdits((s) => ({ ...s, [r.key]: e.target.value }))} aria-label={`Traducción de ${r.key}`} />,
          },
        ]}
      />
    </AdminPage>
  );
}
