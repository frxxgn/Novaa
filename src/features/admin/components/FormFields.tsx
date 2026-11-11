// Generador de formularios a partir de definiciones de campos (FieldDef).
// Lo usan el editor visual de secciones y todos los gestores de contenido.
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ImageIcon, Plus, Trash2, X } from "lucide-react";
import type { FieldDef } from "@/features/cms/schema";
import { cn } from "@/lib/utils";
import { Icon, ICON_NAMES } from "@/components/ui/Icon";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { MediaPicker } from "./MediaPicker";

export type AdminFieldType = FieldDef["type"] | "date" | "json" | "email" | "url" | "readonly" | "datetime";
export interface AdminField extends Omit<FieldDef, "type" | "fields"> {
  type: AdminFieldType;
  fields?: AdminField[];
  required?: boolean;
  span?: 1 | 2;
}

type Obj = Record<string, unknown>;

export function FormFields({ fields, value, onChange, compact }: { fields: AdminField[]; value: Obj; onChange: (v: Obj) => void; compact?: boolean }) {
  return (
    <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
      {fields.map((f) => (
        <div key={f.name} className={cn(compact || f.span === 1 ? "" : ["text", "number", "select", "switch", "color", "icon", "date", "email", "url", "datetime"].includes(f.type) ? "" : "sm:col-span-2")}>
          <FieldInput field={f} value={value[f.name]} onChange={(v) => onChange({ ...value, [f.name]: v })} />
        </div>
      ))}
    </div>
  );
}

export function FieldInput({ field: f, value, onChange }: { field: AdminField; value: unknown; onChange: (v: unknown) => void }) {
  const [picker, setPicker] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  switch (f.type) {
    case "readonly":
      return (
        <Field label={f.label} hint={f.help}>
          <p className="rounded-sm border border-tone bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-muted">{String(value ?? "—")}</p>
        </Field>
      );
    case "textarea":
    case "richtext":
      return <Textarea label={f.label} hint={f.help} required={f.required} maxLength={f.maxLength} rows={f.type === "richtext" ? 12 : 3} className={f.type === "richtext" ? "font-mono text-[13px]" : ""} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
    case "number":
      return <Input label={f.label} hint={f.help} required={f.required} type="number" min={f.min} max={f.max} step={f.step ?? "any"} value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "switch":
      return (
        <div className="flex h-full items-center rounded-sm border border-tone px-3 py-2.5">
          <div className="w-full">
            <Switch label={f.label} description={f.help} checked={Boolean(value)} onChange={onChange} />
          </div>
        </div>
      );
    case "select":
      return <Select label={f.label} hint={f.help} required={f.required} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} options={f.options ?? []} placeholder={f.required ? undefined : "—"} />;
    case "color":
      return (
        <Field label={f.label} hint={f.help}>
          <div className="flex items-center gap-2">
            <input type="color" aria-label={f.label} value={String(value || "#6c26e8").slice(0, 7)} onChange={(e) => onChange(e.target.value)} className="size-11 cursor-pointer rounded-sm border border-tone bg-transparent p-1" />
            <input className="h-11 flex-1 rounded-sm border border-tone bg-white/[0.04] px-3 font-mono text-sm" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="#6c26e8" aria-label={`${f.label} (hex)`} />
          </div>
        </Field>
      );
    case "icon":
      return (
        <Field label={f.label} hint={f.help}>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm border border-tone">
              <Icon name={String(value || "sparkles")} className="size-5" />
            </span>
            <select className="h-11 flex-1 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={String(value ?? "sparkles")} onChange={(e) => onChange(e.target.value)} aria-label={f.label}>
              {ICON_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </Field>
      );
    case "image":
      return (
        <Field label={f.label} hint={f.help ?? "Imagen o vídeo de la biblioteca de medios, o una URL https."}>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-tone bg-white/5">
              {typeof value === "string" && value && !/\.(mp4|webm)$/i.test(value) ? <img src={value} alt="" className="size-full object-cover" /> : <ImageIcon className="size-4 text-muted" />}
            </span>
            <input className="h-11 min-w-0 flex-1 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="https://…" aria-label={f.label} />
            <button type="button" className="h-11 shrink-0 rounded-sm border border-tone px-3 text-sm hover:bg-white/5" onClick={() => setPicker(true)}>
              Elegir
            </button>
            {Boolean(value) && (
              <button type="button" className="h-11 shrink-0 rounded-sm px-2 text-muted hover:text-danger" onClick={() => onChange("")} aria-label="Quitar">
                <X className="size-4" />
              </button>
            )}
          </div>
          <MediaPicker
            open={picker}
            onClose={() => setPicker(false)}
            onSelect={(url) => {
              onChange(url);
              setPicker(false);
            }}
          />
        </Field>
      );
    case "link": {
      const v = (value ?? {}) as { label?: string; href?: string };
      return (
        <Field label={f.label} hint={f.help ?? "Rutas internas (/contacto), anclas (#nova) o URLs https://"}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="h-11 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" placeholder="Texto del botón" value={v.label ?? ""} onChange={(e) => onChange({ ...v, label: e.target.value })} aria-label={`${f.label}: texto`} />
            <input className="h-11 rounded-sm border border-tone bg-white/[0.04] px-3 font-mono text-sm" placeholder="/ruta o https://" value={v.href ?? ""} onChange={(e) => onChange({ ...v, href: e.target.value })} aria-label={`${f.label}: enlace`} />
          </div>
        </Field>
      );
    }
    case "strings":
      return <StringsInput label={f.label} help={f.help} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "list":
      return <ListInput field={f} value={Array.isArray(value) ? (value as Obj[]) : []} onChange={onChange} />;
    case "json":
      return (
        <Field label={f.label} hint={jsonError ?? f.help} error={jsonError}>
          <textarea
            className="min-h-40 w-full rounded-sm border border-tone bg-white/[0.04] p-3 font-mono text-xs"
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              try {
                onChange(JSON.parse(e.target.value));
                setJsonError(null);
              } catch {
                setJsonError("JSON no válido");
              }
            }}
            aria-label={f.label}
          />
        </Field>
      );
    case "date":
      return <Input label={f.label} hint={f.help} type="date" required={f.required} value={String(value ?? "").slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} />;
    case "datetime":
      return <Input label={f.label} hint={f.help} type="datetime-local" required={f.required} value={value ? String(value).slice(0, 16) : ""} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
    default:
      return <Input label={f.label} hint={f.help} required={f.required} type={f.type === "email" ? "email" : f.type === "url" ? "url" : "text"} maxLength={f.maxLength} placeholder={f.placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

function StringsInput({ label, help, value, onChange }: { label: string; help?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft("");
  };
  return (
    <Field label={label} hint={help ?? "Pulsa Intro para añadir."}>
      <div className="rounded-sm border border-tone p-2">
        <ul className="flex flex-wrap gap-1.5">
          {value.map((s, i) => (
            <li key={`${s}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-white/10 py-1 pl-3 pr-1 text-xs">
              {s}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Quitar ${s}`}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            className="h-9 min-w-0 flex-1 rounded-sm bg-white/[0.04] px-3 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Añadir…"
            aria-label={`Añadir a ${label}`}
          />
          <button type="button" onClick={add} className="rounded-sm border border-tone px-3 text-sm hover:bg-white/5">
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </Field>
  );
}

function ListInput({ field, value, onChange }: { field: AdminField; value: Obj[]; onChange: (v: Obj[]) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const sub = field.fields ?? [];
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const title = (item: Obj, i: number) => String(item[sub[0]?.name ?? "title"] ?? item.title ?? `Elemento ${i + 1}`) || `Elemento ${i + 1}`;
  return (
    <Field label={field.label} hint={field.help}>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-sm border border-tone">
            <div className="flex items-center gap-1 px-3 py-2">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", open === i && "rotate-180")} />
                <span className="truncate">{title(item, i)}</span>
              </button>
              <button type="button" onClick={() => move(i, -1)} className="rounded p-1 text-muted hover:bg-white/10" aria-label="Subir">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="rounded p-1 text-muted hover:bg-white/10" aria-label="Bajar">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1 text-muted hover:bg-danger/20 hover:text-danger" aria-label="Eliminar">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            {open === i && (
              <div className="border-t border-tone p-3">
                <FormFields compact fields={sub} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            onChange([...value, Object.fromEntries(sub.map((s) => [s.name, s.type === "strings" || s.type === "list" ? [] : s.type === "switch" ? false : ""]))]);
            setOpen(value.length);
          }}
          className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-tone px-3 py-2 text-sm text-muted hover:text-[var(--tone-fg)]"
        >
          <Plus className="size-4" /> Añadir
        </button>
      </div>
    </Field>
  );
}
