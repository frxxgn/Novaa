// Editor visual de páginas: estructura · previsualización en vivo · propiedades.
// Los cambios se guardan como borrador (page_sections) y solo se ven en la web
// al publicar (publish_page crea una versión inmutable en page_versions).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GitCompare,
  GripVertical,
  History,
  Laptop,
  Loader2,
  Monitor,
  Plus,
  Rocket,
  Save,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type { SectionData, SeoMeta, I18n } from "@/types/content";
import { SCHEMA_BY_TYPE, SECTION_SCHEMAS, STYLE_FIELDS } from "@/features/cms/schema";
import { Button } from "@/components/ui/Button";
import { Badge, Notice, Spinner, useToast } from "@/components/ui/feedback";
import { Drawer, Modal, useConfirm } from "@/components/ui/overlay";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/form";
import { FormFields, type AdminField } from "../components/FormFields";

interface PageRow {
  id: string;
  path: string;
  title: string;
  kind: string;
  is_system: boolean;
  seo: SeoMeta;
  i18n: I18n;
  published_version_id: string | null;
  has_unpublished_changes: boolean;
}

interface VersionRow {
  id: string;
  version: number;
  note: string;
  published_at: string;
  snapshot: { title: string; seo: SeoMeta; sections: SectionData[] };
}

// Anchura real de cada dispositivo: el iframe se renderiza a ese tamaño y se
// escala para caber en el panel, así las media queries responden de verdad.
const DEVICES = {
  desktop: { width: 1440, icon: Monitor, label: "Escritorio" },
  laptop: { width: 1280, icon: Laptop, label: "Portátil" },
  tablet: { width: 820, icon: Tablet, label: "Tablet" },
  mobile: { width: 390, icon: Smartphone, label: "Móvil" },
} as const;

const PAGE_FIELDS: AdminField[] = [
  { name: "title", label: "Título interno", type: "text", required: true },
  { name: "path", label: "Ruta", type: "text", help: "Las páginas del sistema no pueden cambiar de ruta." },
];
const SEO_FIELDS: AdminField[] = [
  { name: "title", label: "Título SEO", type: "text", maxLength: 70, help: "Recomendado: hasta 60 caracteres." },
  { name: "description", label: "Meta descripción", type: "textarea", maxLength: 180, help: "Recomendado: 120–160 caracteres." },
  { name: "og_image", label: "Imagen para redes (Open Graph)", type: "image" },
  { name: "canonical", label: "URL canónica", type: "text", help: "Déjalo vacío para usar la URL de la página." },
  { name: "noindex", label: "Ocultar a buscadores (noindex)", type: "switch" },
];
const I18N_FIELDS: AdminField[] = [
  { name: "title", label: "Título SEO (inglés)", type: "text" },
  { name: "description", label: "Descripción (inglés)", type: "textarea" },
];

const newId = () => crypto.randomUUID();

export default function PageEditor() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const iframe = useRef<HTMLIFrameElement>(null);

  const [page, setPage] = useState<PageRow | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [original, setOriginal] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"section" | "page">("section");
  const [device, setDevice] = useState<keyof typeof DEVICES>("desktop");
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 900, h: 700 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth - 24, h: el.clientHeight - 24 }));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const scale = Math.min(1, stageSize.w / DEVICES[device].width);
  const stageHeight = Math.max(400, stageSize.h - (typeof window !== "undefined" && window.innerWidth < 1024 ? 48 : 0));

  const load = useQuery({
    queryKey: ["admin", "page-editor", id],
    queryFn: async () => {
      const [p, s] = await Promise.all([supabase.from("pages").select("*").eq("id", id).single(), supabase.from("page_sections").select("*").eq("page_id", id).order("position")]);
      if (p.error) throw p.error;
      return { page: p.data as PageRow, sections: (s.data ?? []) as SectionData[] };
    },
  });
  const versions = useQuery({
    queryKey: ["admin", "page-versions", id],
    queryFn: async () => ((await supabase.from("page_versions").select("id, version, note, published_at, snapshot").eq("page_id", id).order("version", { ascending: false }).limit(50)).data ?? []) as VersionRow[],
  });

  useEffect(() => {
    if (!load.data) return;
    setPage(load.data.page);
    const s = load.data.sections.map((x) => ({ id: x.id, type: x.type, label: x.label, props: x.props ?? {}, style: x.style ?? {}, is_visible: x.is_visible }));
    setSections(s);
    setOriginal(JSON.stringify({ p: load.data.page, s }));
    setSelected((cur) => cur ?? s[0]?.id ?? null);
  }, [load.data]);

  const dirty = useMemo(() => page !== null && JSON.stringify({ p: page, s: sections }) !== original, [page, sections, original]);
  const current = sections.find((s) => s.id === selected) ?? null;
  const schema = current ? SCHEMA_BY_TYPE[current.type] : undefined;
  const published = versions.data?.find((v) => v.id === page?.published_version_id) ?? null;

  // Previsualización en vivo: se envía el borrador al iframe
  const pushPreview = useCallback(() => {
    iframe.current?.contentWindow?.postMessage({ type: "nv-preview-sections", sections, selected }, window.location.origin);
  }, [sections, selected]);
  useEffect(() => {
    pushPreview();
  }, [pushPreview]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "nv-preview-ready") pushPreview();
      if (e.data?.type === "nv-select" && typeof e.data.id === "string") {
        setSelected(e.data.id);
        setTab("section");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [pushPreview]);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const updateSection = (patch: Partial<SectionData>) => setSections((list) => list.map((s) => (s.id === selected ? { ...s, ...patch } : s)));
  const move = (index: number, dir: -1 | 1) =>
    setSections((list) => {
      const j = index + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });

  const save = useCallback(async (): Promise<boolean> => {
    if (!page) return false;
    setSaving(true);
    try {
      const before = load.data?.sections.map((s) => s.id) ?? [];
      const removed = before.filter((x) => !sections.some((s) => s.id === x));
      if (removed.length) {
        const { error } = await supabase.from("page_sections").delete().in("id", removed);
        if (error) throw error;
      }
      if (sections.length) {
        const { error } = await supabase.from("page_sections").upsert(sections.map((s, i) => ({ id: s.id, page_id: page.id, type: s.type, label: s.label, props: s.props, style: s.style, is_visible: s.is_visible, position: i })));
        if (error) throw error;
      }
      const { error: pErr } = await supabase.from("pages").update({ title: page.title, seo: page.seo, i18n: page.i18n, ...(page.is_system ? {} : { path: page.path, kind: page.kind }) }).eq("id", page.id);
      if (pErr) throw pErr;
      await load.refetch();
      void qc.invalidateQueries({ queryKey: ["admin", "pages"] });
      toast("success", "Borrador guardado", "Los cambios aún no son visibles en la web.");
      return true;
    } catch (e) {
      toast("error", "No se pudo guardar", errorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [page, sections, load, qc, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const publish = async () => {
    if (dirty && !(await save())) return;
    const { error } = await supabase.rpc("publish_page", { p_page_id: id, p_note: note });
    if (error) {
      toast("error", "No se pudo publicar", errorMessage(error));
      return;
    }
    setPublishOpen(false);
    setNote("");
    await Promise.all([load.refetch(), versions.refetch()]);
    void qc.invalidateQueries({ queryKey: ["page"] });
    void qc.invalidateQueries({ queryKey: ["admin", "pages"] });
    toast("success", "Página publicada", "Los cambios ya están en la web.");
  };

  const restore = async (v: VersionRow) => {
    if (!(await confirm(`¿Restaurar la versión ${v.version}?`, { text: "Sustituirá el borrador actual. No se publicará hasta que pulses «Publicar».", confirmLabel: "Restaurar" }))) return;
    const { error } = await supabase.rpc("restore_page_version", { p_version_id: v.id });
    if (error) return toast("error", "No se pudo restaurar", errorMessage(error));
    setVersionsOpen(false);
    await load.refetch();
    toast("success", `Versión ${v.version} restaurada como borrador`);
  };

  const addSection = (type: string) => {
    const sch = SCHEMA_BY_TYPE[type]!;
    const s: SectionData = { id: newId(), type, label: sch.label, props: structuredClone(sch.defaults), style: { tone: sch.defaultTone }, is_visible: true };
    setSections((list) => {
      const i = list.findIndex((x) => x.id === selected);
      const next = [...list];
      next.splice(i >= 0 ? i + 1 : next.length, 0, s);
      return next;
    });
    setSelected(s.id);
    setTab("section");
    setAddOpen(false);
  };

  if (load.isLoading || !page) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const writable = can("content.manage");

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Barra superior */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-tone px-3" style={{ background: "var(--nv-surface-dark)" }}>
        <Link to="/admin/paginas" className="rounded-sm p-2 hover:bg-white/10" aria-label="Volver a páginas">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{page.title}</p>
          <p className="truncate font-mono text-[11px] text-muted">{page.path}</p>
        </div>
        <div className="ml-2 hidden sm:block">
          {dirty ? <Badge tone="warning">Cambios sin guardar</Badge> : page.has_unpublished_changes ? <Badge tone="info">Borrador sin publicar</Badge> : page.published_version_id ? <Badge tone="success">Publicada</Badge> : <Badge tone="warning">Sin publicar</Badge>}
        </div>
        <div className="mx-auto hidden items-center rounded-full border border-tone p-0.5 md:flex" role="radiogroup" aria-label="Dispositivo">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((k) => {
            const D = DEVICES[k];
            return (
              <button key={k} role="radio" aria-checked={device === k} title={D.label} onClick={() => setDevice(k)} className={cn("rounded-full p-1.5", device === k ? "bg-white text-ink" : "text-muted hover:text-[var(--tone-fg)]")}>
                <D.icon className="size-4" />
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<History className="size-4" />} onClick={() => setVersionsOpen(true)}>
            <span className="hidden lg:inline">Versiones</span>
          </Button>
          <Button size="sm" variant="ghost" icon={<GitCompare className="size-4" />} onClick={() => setCompareOpen(true)} disabled={!published}>
            <span className="hidden lg:inline">Comparar</span>
          </Button>
          {writable && (
            <Button size="sm" variant="outline" icon={<Save className="size-4" />} onClick={() => void save()} loading={saving} disabled={!dirty}>
              <span className="hidden sm:inline">Guardar</span>
            </Button>
          )}
          {can("content.publish") && (
            <Button size="sm" icon={<Rocket className="size-4" />} onClick={() => setPublishOpen(true)}>
              Publicar
            </Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr_360px]">
        {/* Estructura */}
        <aside className="hidden min-h-0 flex-col border-r border-tone lg:flex" aria-label="Estructura">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Estructura</p>
            {writable && (
              <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs text-white">
                <Plus className="size-3.5" /> Sección
              </button>
            )}
          </div>
          <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {sections.map((s, i) => {
              const sch = SCHEMA_BY_TYPE[s.type];
              return (
                <li
                  key={s.id}
                  draggable={writable}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === i) return;
                    setSections((list) => {
                      const next = [...list];
                      const [item] = next.splice(dragIndex, 1);
                      next.splice(i, 0, item!);
                      return next;
                    });
                    setDragIndex(null);
                  }}
                  className={cn("group flex items-center gap-1.5 rounded-sm border px-2 py-2 text-sm", selected === s.id ? "border-lavender bg-white/10" : "border-transparent hover:bg-white/5", !s.is_visible && "opacity-50")}
                >
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted" aria-hidden />
                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { setSelected(s.id); setTab("section"); }}>
                    <Icon name={sch?.icon ?? "layers"} className="size-3.5 shrink-0 text-lavender" />
                    <span className="truncate">{s.label || sch?.label || s.type}</span>
                  </button>
                  {writable && (
                    <span className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button className="rounded p-0.5 hover:bg-white/10" onClick={() => move(i, -1)} aria-label="Subir">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button className="rounded p-0.5 hover:bg-white/10" onClick={() => move(i, 1)} aria-label="Bajar">
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button className="rounded p-0.5 hover:bg-white/10" onClick={() => setSections((l) => l.map((x) => (x.id === s.id ? { ...x, is_visible: !x.is_visible } : x)))} aria-label={s.is_visible ? "Ocultar" : "Mostrar"}>
                        {s.is_visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
            {sections.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">Página vacía. Añade una sección.</li>}
          </ol>
          <button onClick={() => setTab("page")} className={cn("flex items-center gap-2 border-t border-tone px-4 py-3 text-sm", tab === "page" ? "text-[var(--tone-fg)]" : "text-muted hover:text-[var(--tone-fg)]")}>
            <Settings2 className="size-4" /> Ajustes de página y SEO
          </button>
        </aside>

        {/* Previsualización */}
        <div ref={stage} className="relative min-h-[50vh] overflow-hidden bg-[#0a0b1e] p-3" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.06) 1px, transparent 0)", backgroundSize: "22px 22px" }}>
          <div className="mx-auto overflow-hidden rounded-md border border-white/10 bg-[var(--nv-bg-dark)] shadow-2xl" style={{ width: DEVICES[device].width * scale, height: stageHeight }}>
            <iframe
              ref={iframe}
              title="Previsualización del borrador"
              src={`/__preview/page/${id}`}
              className="origin-top-left border-0"
              style={{ width: DEVICES[device].width, height: stageHeight / scale, transform: `scale(${scale})` }}
              onLoad={pushPreview}
            />
          </div>
          <div className="mt-2 flex justify-center gap-2 lg:hidden">
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} icon={<Plus className="size-4" />}>
              Sección
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTab(tab === "page" ? "section" : "page")}>
              {tab === "page" ? "Editar sección" : "Ajustes de página"}
            </Button>
          </div>
        </div>

        {/* Propiedades */}
        <aside className="min-h-0 overflow-y-auto border-l border-tone p-4" aria-label="Propiedades">
          {!writable && <Notice tone="info" className="mb-4">Solo lectura: no tienes permiso para editar contenido.</Notice>}
          <fieldset disabled={!writable}>
            {tab === "page" ? (
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Página</p>
                  <FormFields compact fields={PAGE_FIELDS.map((f) => (f.name === "path" && page.is_system ? { ...f, type: "readonly" } : f))} value={page as unknown as Record<string, unknown>} onChange={(v) => setPage({ ...page, ...(v as Partial<PageRow>) })} />
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">SEO</p>
                  <FormFields compact fields={SEO_FIELDS} value={page.seo as Record<string, unknown>} onChange={(v) => setPage({ ...page, seo: v as SeoMeta })} />
                  <SeoPreview title={page.seo?.title || page.title} description={page.seo?.description ?? ""} path={page.path} />
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Traducción (inglés)</p>
                  <FormFields compact fields={I18N_FIELDS} value={(page.i18n?.en ?? {}) as Record<string, unknown>} onChange={(v) => setPage({ ...page, i18n: { ...page.i18n, en: v as Record<string, string> } })} />
                </div>
              </div>
            ) : current && schema ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted">{schema.label}</p>
                    <p className="mt-1 text-xs text-muted">{schema.description}</p>
                  </div>
                  {writable && (
                    <span className="flex gap-1">
                      <button className="rounded p-1.5 hover:bg-white/10" title="Duplicar" aria-label="Duplicar sección" onClick={() => {
                        const copy = { ...structuredClone(current), id: newId(), label: `${current.label} (copia)` };
                        setSections((l) => { const i = l.findIndex((x) => x.id === current.id); const n = [...l]; n.splice(i + 1, 0, copy); return n; });
                        setSelected(copy.id);
                      }}>
                        <Copy className="size-4" />
                      </button>
                      <button className="rounded p-1.5 hover:bg-danger/20 hover:text-danger" title="Eliminar" aria-label="Eliminar sección" onClick={async () => {
                        if (await confirm("¿Eliminar esta sección?", { danger: true, text: "Se quitará del borrador. Podrás recuperarla restaurando una versión publicada.", confirmLabel: "Eliminar" })) {
                          setSections((l) => l.filter((x) => x.id !== current.id));
                          setSelected(null);
                        }
                      }}>
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  )}
                </div>
                <Input label="Nombre en la estructura" value={current.label} onChange={(e) => updateSection({ label: e.target.value })} />
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Contenido</p>
                  <FormFields compact fields={schema.fields as AdminField[]} value={current.props} onChange={(v) => updateSection({ props: v })} />
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Estilo</p>
                  <FormFields compact fields={STYLE_FIELDS as AdminField[]} value={current.style as Record<string, unknown>} onChange={(v) => updateSection({ style: v as SectionData["style"] })} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Selecciona una sección en la estructura o haz clic sobre ella en la previsualización.</p>
            )}
          </fieldset>
        </aside>
      </div>

      {/* Añadir sección */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Añadir sección" description="Se insertará después de la sección seleccionada." size="lg">
        <ul className="grid gap-2 sm:grid-cols-2">
          {SECTION_SCHEMAS.map((s) => (
            <li key={s.type}>
              <button onClick={() => addSection(s.type)} className="flex w-full items-start gap-3 rounded-sm border border-tone p-3 text-left hover:border-lavender hover:bg-white/5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lavender">
                  <Icon name={s.icon} className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted">{s.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Publicar */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publicar página"
        description="Se creará una nueva versión y la web mostrará estos cambios inmediatamente."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button icon={<Rocket className="size-4" />} onClick={() => void publish()}>
              {dirty ? "Guardar y publicar" : "Publicar"}
            </Button>
          </>
        }
      >
        <Textarea label="Nota de la versión (opcional)" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué ha cambiado…" />
        {page.published_version_id && !page.is_system && (
          <button
            className="mt-4 text-xs text-danger underline"
            onClick={async () => {
              const { error } = await supabase.rpc("unpublish_page", { p_page_id: id });
              if (error) toast("error", "No se pudo despublicar", errorMessage(error));
              else {
                toast("success", "Página retirada de la web");
                setPublishOpen(false);
                void load.refetch();
              }
            }}
          >
            Despublicar esta página
          </button>
        )}
      </Modal>

      {/* Versiones */}
      <Drawer open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Historial de versiones">
        {versions.isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : !versions.data?.length ? (
          <p className="text-sm text-muted">Esta página todavía no se ha publicado.</p>
        ) : (
          <ul className="space-y-2">
            {versions.data.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-3 rounded-sm border border-tone p-3">
                <div>
                  <p className="text-sm font-medium">
                    Versión {v.version} {v.id === page.published_version_id && <Badge tone="success">Publicada</Badge>}
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(v.published_at)}</p>
                  {v.note && <p className="mt-1 text-xs">{v.note}</p>}
                  <p className="mt-1 text-xs text-muted">{v.snapshot.sections.length} secciones</p>
                </div>
                {writable && (
                  <Button size="sm" variant="outline" icon={<Undo2 className="size-3.5" />} onClick={() => void restore(v)}>
                    Restaurar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Drawer>

      {/* Comparar borrador con publicada */}
      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Borrador frente a versión publicada" size="lg">
        {published ? <CompareView published={published} draft={{ title: page.title, seo: page.seo, sections }} /> : <p className="text-sm text-muted">No hay versión publicada.</p>}
      </Modal>
      {dialog}
      {/* Navegación con cambios sin guardar */}
      {dirty && (
        <button className="sr-only" onClick={() => navigate("/admin/paginas")}>
          Salir sin guardar
        </button>
      )}
    </div>
  );
}

function SeoPreview({ title, description, path }: { title: string; description: string; path: string }) {
  return (
    <div className="mt-4 rounded-sm border border-tone bg-white p-3 text-[13px] text-[#202124]">
      <p className="truncate text-xs text-[#4d5156]">{window.location.host}{path}</p>
      <p className="truncate text-[17px] text-[#1a0dab]">{title} · Novalius</p>
      <p className="line-clamp-2 text-[#4d5156]">{description || "Añade una meta descripción para controlar el texto que muestran los buscadores."}</p>
    </div>
  );
}

function CompareView({ published, draft }: { published: VersionRow; draft: { title: string; seo: SeoMeta; sections: SectionData[] } }) {
  const changes: { kind: "added" | "removed" | "modified" | "moved"; label: string; detail?: string }[] = [];
  if (published.snapshot.title !== draft.title) changes.push({ kind: "modified", label: "Título de la página", detail: `«${published.snapshot.title}» → «${draft.title}»` });
  if (JSON.stringify(published.snapshot.seo ?? {}) !== JSON.stringify(draft.seo ?? {})) changes.push({ kind: "modified", label: "Metadatos SEO" });
  const pubById = new Map(published.snapshot.sections.map((s, i) => [s.id, { s, i }]));
  const draftIds = new Set(draft.sections.map((s) => s.id));
  draft.sections.forEach((s, i) => {
    const before = pubById.get(s.id);
    if (!before) {
      // Restaurar recrea ids: se compara por tipo+contenido
      const same = published.snapshot.sections.find((p) => p.type === s.type && JSON.stringify(p.props) === JSON.stringify(s.props));
      if (!same) changes.push({ kind: "added", label: s.label || s.type });
      return;
    }
    const keys = [...new Set([...Object.keys(before.s.props ?? {}), ...Object.keys(s.props ?? {})])].filter((k) => JSON.stringify(before.s.props?.[k]) !== JSON.stringify(s.props?.[k]));
    if (keys.length || JSON.stringify(before.s.style) !== JSON.stringify(s.style) || before.s.is_visible !== s.is_visible) {
      changes.push({ kind: "modified", label: s.label || s.type, detail: [keys.length ? `Campos: ${keys.join(", ")}` : "", JSON.stringify(before.s.style) !== JSON.stringify(s.style) ? "Estilo" : "", before.s.is_visible !== s.is_visible ? (s.is_visible ? "Ahora visible" : "Ahora oculta") : ""].filter(Boolean).join(" · ") });
    } else if (before.i !== i) changes.push({ kind: "moved", label: s.label || s.type, detail: `Posición ${before.i + 1} → ${i + 1}` });
  });
  for (const p of published.snapshot.sections) if (!draftIds.has(p.id) && !draft.sections.some((s) => s.type === p.type && JSON.stringify(p.props) === JSON.stringify(s.props))) changes.push({ kind: "removed", label: p.label || p.type });

  const tone = { added: "success", removed: "danger", modified: "warning", moved: "info" } as const;
  const label = { added: "Añadida", removed: "Eliminada", modified: "Modificada", moved: "Movida" };
  return changes.length === 0 ? (
    <p className="text-sm text-muted">El borrador es igual a la versión publicada (v{published.version}).</p>
  ) : (
    <ul className="space-y-2">
      {changes.map((c, i) => (
        <li key={i} className="flex items-start gap-3 rounded-sm border border-tone p-3 text-sm">
          <Badge tone={tone[c.kind]}>{label[c.kind]}</Badge>
          <div>
            <p className="font-medium">{c.label}</p>
            {c.detail && <p className="text-xs text-muted">{c.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
