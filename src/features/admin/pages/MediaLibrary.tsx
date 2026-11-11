import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton, useToast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Drawer, useConfirm } from "@/components/ui/overlay";
import { AdminPage } from "../components/ui";
import { MEDIA_ACCEPT, MediaThumb, uploadMedia, useMedia, type MediaAsset } from "../components/MediaPicker";

export default function MediaLibrary() {
  const media = useMedia();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [filter, setFilter] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(files.length);
    for (const f of Array.from(files)) {
      try {
        await uploadMedia(f);
      } catch (e) {
        toast("error", `No se pudo subir ${f.name}`, errorMessage(e));
      }
      setUploading((n) => n - 1);
    }
    void qc.invalidateQueries({ queryKey: ["admin", "media"] });
  };

  const list = (media.data ?? []).filter((m) => `${m.title} ${m.alt} ${m.path}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <AdminPage
      title="Medios"
      description="Imágenes, vídeos y documentos públicos de la web (Supabase Storage). Formatos: PNG, JPG, WebP, AVIF, GIF, SVG, MP4, WebM y PDF · máx. 20 MB. Añade siempre un texto alternativo."
      actions={
        <>
          <input ref={input} type="file" accept={MEDIA_ACCEPT} multiple hidden onChange={(e) => void upload(e.target.files)} />
          <Button icon={uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} onClick={() => input.current?.click()} disabled={uploading > 0}>
            {uploading ? `Subiendo ${uploading}…` : "Subir archivos"}
          </Button>
        </>
      }
    >
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        <input className="mb-4 h-10 w-full max-w-xs rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" placeholder="Buscar…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar medios" />
        {media.isLoading ? (
          <Skeleton className="h-64" />
        ) : list.length === 0 ? (
          <EmptyState title="Sin archivos" text="Arrastra archivos aquí o pulsa «Subir archivos»." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {list.map((m) => (
              <li key={m.id}>
                <button onClick={() => setSelected(m)} className="block w-full overflow-hidden rounded-sm border border-tone text-left hover:border-lavender">
                  <div className="aspect-square">
                    <MediaThumb asset={m} />
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs">{m.title || m.path}</p>
                    <p className="text-[10px] text-muted">
                      {(m.size_bytes / 1024).toFixed(0)} KB {!m.alt && m.kind === "image" ? "· sin alt" : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Archivo"
        footer={
          selected && (
            <>
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (!(await confirm("¿Eliminar este archivo?", { danger: true, text: "Si se usa en alguna página dejará de verse.", confirmLabel: "Eliminar" }))) return;
                  const { error } = await supabase.storage.from("media").remove([selected.path]);
                  if (error) return toast("error", "No se pudo eliminar", errorMessage(error));
                  await supabase.from("media_assets").delete().eq("id", selected.id);
                  setSelected(null);
                  void qc.invalidateQueries({ queryKey: ["admin", "media"] });
                }}
              >
                Eliminar
              </Button>
              <Button
                onClick={async () => {
                  const { error } = await supabase.from("media_assets").update({ alt: selected.alt, title: selected.title }).eq("id", selected.id);
                  if (error) toast("error", "No se pudo guardar", errorMessage(error));
                  else {
                    toast("success", "Guardado");
                    void qc.invalidateQueries({ queryKey: ["admin", "media"] });
                  }
                }}
              >
                Guardar
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-sm border border-tone">
              {selected.kind === "video" ? <video src={selected.public_url} controls className="w-full" /> : selected.kind === "image" ? <img src={selected.public_url} alt={selected.alt} className="w-full" /> : <MediaThumb asset={selected} className="h-40" />}
            </div>
            <Input label="Título" value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} />
            <Input label="Texto alternativo (accesibilidad)" value={selected.alt} onChange={(e) => setSelected({ ...selected, alt: e.target.value })} />
            <div className="flex items-center gap-2">
              <input readOnly value={selected.public_url} className="h-10 min-w-0 flex-1 rounded-sm border border-tone bg-white/[0.04] px-3 font-mono text-xs" aria-label="URL pública" />
              <Button size="sm" variant="outline" icon={<Copy className="size-4" />} onClick={() => void navigator.clipboard.writeText(selected.public_url).then(() => toast("success", "URL copiada"))}>
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted">
              {selected.mime_type} · {(selected.size_bytes / 1024).toFixed(0)} KB {selected.width ? `· ${selected.width}×${selected.height}` : ""} · subido el {formatDate(selected.created_at)}
            </p>
          </div>
        )}
      </Drawer>
      {dialog}
    </AdminPage>
  );
}
