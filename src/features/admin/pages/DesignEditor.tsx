// Editor de diseño global (tokens) y de animaciones, con borrador, publicación,
// historial y previsualización en vivo. Los valores se limitan a rangos seguros.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, Monitor, Rocket, Save, Smartphone, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { contrastRatio, DEFAULT_ANIMATIONS, DEFAULT_TOKENS, FONT_FAMILIES, normalizeAnimations, normalizeTokens } from "@/lib/design";
import { cn, formatDateTime } from "@/lib/utils";
import type { AnimationSettings, DesignTokens } from "@/types/content";
import { Button } from "@/components/ui/Button";
import { Badge, Notice, Spinner, useToast } from "@/components/ui/feedback";
import { RangeInput, Select, Switch, Textarea } from "@/components/ui/form";
import { Drawer, Modal, useConfirm } from "@/components/ui/overlay";
import { AdminPage, Card } from "../components/ui";

interface DesignRow {
  id: string;
  status: "draft" | "published" | "archived";
  tokens: DesignTokens;
  animations: AnimationSettings;
  note: string;
  published_at: string | null;
}

const COLOR_LABELS: [string, string][] = [
  ["primary", "Morado principal"],
  ["secondary", "Violeta secundario"],
  ["lavender", "Lavanda"],
  ["ink", "Tinta (azul profundo)"],
  ["navy", "Azul marino"],
  ["indigo", "Índigo"],
  ["silver", "Plata"],
  ["bg_dark", "Fondo oscuro"],
  ["surface_dark", "Superficie oscura"],
  ["bg_light", "Fondo claro"],
  ["surface_light", "Superficie clara"],
  ["text_on_dark", "Texto sobre oscuro"],
  ["text_on_light", "Texto sobre claro"],
  ["success", "Éxito"],
  ["warning", "Aviso"],
  ["danger", "Error"],
  ["info", "Información"],
];

export default function DesignEditor({ tab }: { tab: "design" | "animations" }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const iframe = useRef<HTMLIFrameElement>(null);
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_TOKENS);
  const [animations, setAnimations] = useState<AnimationSettings>(DEFAULT_ANIMATIONS);
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [note, setNote] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const q = useQuery({
    queryKey: ["admin", "design"],
    queryFn: async () => {
      const { data, error } = await supabase.from("design_settings").select("id, status, tokens, animations, note, published_at").order("published_at", { ascending: false, nullsFirst: true }).limit(40);
      if (error) throw error;
      return (data ?? []) as DesignRow[];
    },
  });
  const draft = q.data?.find((d) => d.status === "draft");
  const published = q.data?.find((d) => d.status === "published");
  const history = (q.data ?? []).filter((d) => d.status !== "draft");

  useEffect(() => {
    if (!draft) return;
    const t = normalizeTokens(draft.tokens);
    const a = normalizeAnimations(draft.animations);
    setTokens(t);
    setAnimations(a);
    setOriginal(JSON.stringify({ t, a }));
  }, [draft]);

  const dirty = original !== "" && JSON.stringify({ t: tokens, a: animations }) !== original;
  const differsFromPublished = published ? JSON.stringify({ t: normalizeTokens(published.tokens), a: normalizeAnimations(published.animations) }) !== JSON.stringify({ t: tokens, a: animations }) : true;

  const push = useCallback(() => {
    iframe.current?.contentWindow?.postMessage({ type: "nv-preview-design", tokens, animations }, window.location.origin);
  }, [tokens, animations]);
  useEffect(() => {
    push();
  }, [push]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "nv-preview-ready") push();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [push]);

  const save = async () => {
    setSaving(true);
    try {
      const values = { tokens: normalizeTokens(tokens), animations: normalizeAnimations(animations) };
      const { error } = draft ? await supabase.from("design_settings").update(values).eq("id", draft.id) : await supabase.from("design_settings").insert({ ...values, status: "draft" });
      if (error) throw error;
      await q.refetch();
      toast("success", "Borrador de diseño guardado");
      return true;
    } catch (e) {
      toast("error", "No se pudo guardar", errorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (dirty && !(await save())) return;
    const { error } = await supabase.rpc("publish_design", { p_note: note });
    if (error) return toast("error", "No se pudo publicar", errorMessage(error));
    setPublishOpen(false);
    setNote("");
    await q.refetch();
    void qc.invalidateQueries({ queryKey: ["site-bundle"] });
    toast("success", "Diseño publicado", "La web ya usa el nuevo diseño.");
  };

  const restore = async (row: DesignRow) => {
    if (!(await confirm("¿Restaurar este diseño como borrador?", { text: "No se publicará hasta que pulses «Publicar».", confirmLabel: "Restaurar" }))) return;
    const { error } = await supabase.rpc("restore_design_version", { p_version_id: row.id });
    if (error) return toast("error", "No se pudo restaurar", errorMessage(error));
    setHistoryOpen(false);
    await q.refetch();
  };

  const contrastIssues = useMemo(() => {
    const c = tokens.colors;
    const pairs: [string, string, string, number][] = [
      ["Texto sobre fondo oscuro", c.text_on_dark!, c.bg_dark!, 4.5],
      ["Texto sobre fondo claro", c.text_on_light!, c.bg_light!, 4.5],
      ["Texto blanco sobre morado principal (botones)", "#ffffff", c.primary!, 4.5],
      ["Texto sobre superficie oscura", c.text_on_dark!, c.surface_dark!, 4.5],
    ];
    return pairs.map(([label, a, b, min]) => ({ label, ratio: contrastRatio(a, b), min })).filter((p) => p.ratio < p.min);
  }, [tokens.colors]);

  if (q.isLoading) return <div className="p-10"><Spinner /></div>;

  const setColor = (k: string, v: string) => setTokens((t) => ({ ...t, colors: { ...t.colors, [k]: v } }));

  return (
    <AdminPage
      title={tab === "design" ? "Diseño global" : "Animaciones"}
      description={tab === "design" ? "Colores, tipografías, espaciados, radios y efectos. Los cambios se aplican a toda la web al publicar." : "Velocidad, intensidad y efectos de movimiento. Las preferencias de movimiento reducido del visitante siempre se respetan."}
      actions={
        <>
          {dirty ? <Badge tone="warning">Cambios sin guardar</Badge> : differsFromPublished ? <Badge tone="info">Borrador sin publicar</Badge> : <Badge tone="success">Publicado</Badge>}
          <Button size="sm" variant="ghost" icon={<History className="size-4" />} onClick={() => setHistoryOpen(true)}>
            Historial
          </Button>
          <Button size="sm" variant="outline" icon={<Save className="size-4" />} onClick={() => void save()} loading={saving} disabled={!dirty}>
            Guardar borrador
          </Button>
          <Button size="sm" icon={<Rocket className="size-4" />} onClick={() => setPublishOpen(true)}>
            Publicar
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_1fr]">
        <div className="space-y-6">
          {tab === "design" ? (
            <>
              <Card title="Paleta" description="Basada en el logotipo de referencia. Se comprueba el contraste WCAG.">
                <div className="grid grid-cols-2 gap-3">
                  {COLOR_LABELS.map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-xs">
                      <input type="color" value={(tokens.colors[k] ?? "#000000").slice(0, 7)} onChange={(e) => setColor(k, e.target.value)} className="size-9 shrink-0 cursor-pointer rounded-sm border border-tone bg-transparent p-0.5" aria-label={label} />
                      <span className="min-w-0">
                        <span className="block truncate">{label}</span>
                        <span className="font-mono text-[10px] text-muted">{tokens.colors[k]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {contrastIssues.length > 0 && (
                  <Notice tone="warning" className="mt-4">
                    <p className="font-medium">Contraste insuficiente</p>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {contrastIssues.map((i) => (
                        <li key={i.label}>
                          {i.label}: {i.ratio.toFixed(2)}:1 (mínimo {i.min}:1)
                        </li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </Card>
              <Card title="Tipografía">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Titulares" value={tokens.typography.display} onChange={(e) => setTokens({ ...tokens, typography: { ...tokens.typography, display: e.target.value } })} options={Object.keys(FONT_FAMILIES).filter((f) => f !== "IBM Plex Mono").map((f) => ({ value: f, label: f }))} />
                    <Select label="Texto" value={tokens.typography.body} onChange={(e) => setTokens({ ...tokens, typography: { ...tokens.typography, body: e.target.value } })} options={Object.keys(FONT_FAMILIES).filter((f) => f !== "IBM Plex Mono").map((f) => ({ value: f, label: f }))} />
                  </div>
                  <RangeInput label="Escala de titulares" min={0.8} max={1.25} step={0.01} value={tokens.typography.scale} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => setTokens({ ...tokens, typography: { ...tokens.typography, scale: v } })} />
                  <RangeInput label="Peso de titulares" min={300} max={800} step={50} value={tokens.typography.display_weight} onChange={(v) => setTokens({ ...tokens, typography: { ...tokens.typography, display_weight: v } })} />
                  <RangeInput label="Espaciado entre letras" min={-0.08} max={0.05} step={0.005} value={tokens.typography.display_tracking} format={(v) => `${v.toFixed(3)} em`} onChange={(v) => setTokens({ ...tokens, typography: { ...tokens.typography, display_tracking: v } })} />
                </div>
              </Card>
              <Card title="Forma y espaciado">
                <div className="grid gap-4">
                  {(["sm", "md", "lg"] as const).map((k) => (
                    <RangeInput key={k} label={`Radio ${k === "sm" ? "pequeño" : k === "md" ? "medio" : "grande"}`} min={0} max={k === "lg" ? 56 : k === "md" ? 36 : 24} step={1} value={tokens.radius[k]} format={(v) => `${v} px`} onChange={(v) => setTokens({ ...tokens, radius: { ...tokens.radius, [k]: v } })} />
                  ))}
                  <RangeInput label="Espacio entre secciones" min={64} max={220} step={4} value={tokens.spacing.section} format={(v) => `${v} px`} onChange={(v) => setTokens({ ...tokens, spacing: { ...tokens.spacing, section: v } })} />
                  <RangeInput label="Ancho máximo del contenido" min={960} max={1680} step={10} value={tokens.spacing.container} format={(v) => `${v} px`} onChange={(v) => setTokens({ ...tokens, spacing: { ...tokens.spacing, container: v } })} />
                  <RangeInput label="Margen lateral" min={16} max={48} step={1} value={tokens.spacing.gutter} format={(v) => `${v} px`} onChange={(v) => setTokens({ ...tokens, spacing: { ...tokens.spacing, gutter: v } })} />
                </div>
              </Card>
              <Card title="Efectos">
                <div className="grid gap-4">
                  <RangeInput label="Brillo (glow)" min={0} max={1} step={0.05} value={tokens.effects.glow} onChange={(v) => setTokens({ ...tokens, effects: { ...tokens.effects, glow: v } })} />
                  <RangeInput label="Sombras" min={0} max={0.6} step={0.02} value={tokens.effects.shadow} onChange={(v) => setTokens({ ...tokens, effects: { ...tokens.effects, shadow: v } })} />
                  <RangeInput label="Opacidad del cristal" min={0} max={0.3} step={0.01} value={tokens.effects.glass_opacity} onChange={(v) => setTokens({ ...tokens, effects: { ...tokens.effects, glass_opacity: v } })} />
                  <RangeInput label="Desenfoque del cristal" min={0} max={40} step={1} value={tokens.effects.glass_blur} format={(v) => `${v} px`} onChange={(v) => setTokens({ ...tokens, effects: { ...tokens.effects, glass_blur: v } })} />
                  <RangeInput label="Opacidad de bordes" min={0.04} max={0.4} step={0.01} value={tokens.effects.border_opacity} onChange={(v) => setTokens({ ...tokens, effects: { ...tokens.effects, border_opacity: v } })} />
                  <RangeInput label="Textura de grano" min={0} max={0.15} step={0.01} value={tokens.effects.noise} onChange={(v) => setTokens({ ...tokens, effects: { ...tokens.effects, noise: v } })} />
                </div>
              </Card>
              <Card title="Componentes">
                <div className="grid gap-4">
                  <Select label="Forma de los botones" value={tokens.buttons.shape} onChange={(e) => setTokens({ ...tokens, buttons: { ...tokens.buttons, shape: e.target.value as DesignTokens["buttons"]["shape"] } })} options={[{ value: "pill", label: "Píldora" }, { value: "rounded", label: "Redondeados" }, { value: "square", label: "Rectos" }]} />
                  <Switch label="Botones magnéticos" checked={tokens.buttons.magnetic} onChange={(v) => setTokens({ ...tokens, buttons: { ...tokens.buttons, magnetic: v } })} />
                  <Select label="Estilo de tarjetas" value={tokens.cards.style} onChange={(e) => setTokens({ ...tokens, cards: { ...tokens.cards, style: e.target.value as DesignTokens["cards"]["style"] } })} options={[{ value: "glass", label: "Cristal" }, { value: "solid", label: "Sólidas" }, { value: "outline", label: "Contorno" }]} />
                </div>
              </Card>
            </>
          ) : (
            <>
              <Card title="Movimiento general">
                <div className="grid gap-4">
                  <Switch label="Animaciones activadas" description="Si se desactiva, la web se muestra sin movimiento para todos." checked={animations.enabled} onChange={(v) => setAnimations({ ...animations, enabled: v })} />
                  <RangeInput label="Velocidad" min={0.5} max={2} step={0.05} value={animations.speed} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => setAnimations({ ...animations, speed: v })} />
                  <RangeInput label="Intensidad" min={0} max={1.5} step={0.05} value={animations.intensity} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => setAnimations({ ...animations, intensity: v })} />
                  <Select
                    label="Efecto de aparición al hacer scroll"
                    value={animations.scroll_reveal}
                    onChange={(e) => setAnimations({ ...animations, scroll_reveal: e.target.value as AnimationSettings["scroll_reveal"] })}
                    options={[{ value: "rise", label: "Ascenso" }, { value: "fade", label: "Fundido" }, { value: "blur", label: "Desenfoque" }, { value: "scale", label: "Escala" }, { value: "none", label: "Sin efecto" }]}
                  />
                  <Switch label="Transiciones entre páginas" checked={animations.page_transitions} onChange={(v) => setAnimations({ ...animations, page_transitions: v })} />
                  <Switch label="Scroll suave" checked={animations.smooth_scroll} onChange={(v) => setAnimations({ ...animations, smooth_scroll: v })} />
                </div>
              </Card>
              <Card title="Entrada">
                <div className="grid gap-4">
                  <Switch label="Animación de entrada" description="Se muestra una vez por sesión, en la portada y siempre con botón para saltarla." checked={animations.intro} onChange={(v) => setAnimations({ ...animations, intro: v })} />
                  <RangeInput label="Duración de la entrada" min={0.8} max={4} step={0.1} value={animations.intro_duration} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => setAnimations({ ...animations, intro_duration: v })} />
                </div>
              </Card>
              <Card title="Interacción">
                <div className="grid gap-4">
                  <Switch label="Cursor personalizado" description="Solo en ordenadores con ratón." checked={animations.cursor} onChange={(v) => setAnimations({ ...animations, cursor: v })} />
                  <RangeInput label="Fuerza magnética" min={0} max={0.6} step={0.05} value={animations.magnetic_strength} onChange={(v) => setAnimations({ ...animations, magnetic_strength: v })} />
                  <Switch label="Elementos 3D" description="La esfera del hero usa WebGL; en equipos sin soporte se muestra una versión ligera." checked={animations.three_d} onChange={(v) => setAnimations({ ...animations, three_d: v })} />
                  <Switch label="Partículas" checked={animations.particles} onChange={(v) => setAnimations({ ...animations, particles: v })} />
                  <Switch label="Permitir sonido" description="El sonido siempre empieza desactivado; el visitante lo activa con el botón de la cabecera." checked={animations.sound} onChange={(v) => setAnimations({ ...animations, sound: v })} />
                </div>
              </Card>
              <Notice tone="info">Los visitantes con «movimiento reducido» activado en su sistema ven la web sin animaciones, sin intro y sin 3D, independientemente de estos ajustes.</Notice>
            </>
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted">Previsualización del borrador</p>
            <div className="flex rounded-full border border-tone p-0.5">
              {(
                [
                  ["desktop", Monitor],
                  ["mobile", Smartphone],
                ] as const
              ).map(([k, I]) => (
                <button key={k} onClick={() => setDevice(k)} aria-label={k === "desktop" ? "Escritorio" : "Móvil"} className={cn("rounded-full p-1.5", device === k ? "bg-white text-ink" : "text-muted")}>
                  <I className="size-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="mx-auto overflow-hidden rounded-md border border-tone shadow-2xl transition-[max-width]" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
            <iframe ref={iframe} title="Previsualización del diseño" src="/__preview/design" className="h-[75vh] w-full border-0" onLoad={push} />
          </div>
          {contrastIssues.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="size-3.5" /> Revisa el contraste antes de publicar.
            </p>
          )}
        </div>
      </div>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publicar diseño"
        description="El diseño y las animaciones se aplicarán a toda la web."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void publish()} icon={<Rocket className="size-4" />}>
              Publicar
            </Button>
          </>
        }
      >
        <Textarea label="Nota (opcional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Modal>
      <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historial de diseño">
        <ul className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-3 rounded-sm border border-tone p-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {formatDateTime(h.published_at)} {h.status === "published" && <Badge tone="success">Actual</Badge>}
                </p>
                {h.note && <p className="mt-1 text-xs text-muted">{h.note}</p>}
                <div className="mt-2 flex gap-1">
                  {["primary", "secondary", "lavender", "ink", "bg_dark"].map((k) => (
                    <span key={k} className="size-4 rounded-full border border-white/20" style={{ background: h.tokens?.colors?.[k] }} />
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" icon={<Undo2 className="size-3.5" />} onClick={() => void restore(h)}>
                Restaurar
              </Button>
            </li>
          ))}
          {history.length === 0 && <p className="text-sm text-muted">Sin versiones publicadas.</p>}
        </ul>
      </Drawer>
      {dialog}
    </AdminPage>
  );
}
