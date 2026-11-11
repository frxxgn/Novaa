import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Film, Loader2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { cn, slugify } from "@/lib/utils";
import { Modal } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/feedback";

export interface MediaAsset {
  id: string;
  path: string;
  public_url: string;
  kind: "image" | "video" | "document";
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  title: string;
  created_at: string;
}

export const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/webm,application/pdf";
const MAX_BYTES = 20 * 1024 * 1024;

async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return null;
  try {
    const bmp = await createImageBitmap(file);
    return { width: bmp.width, height: bmp.height };
  } catch {
    return null;
  }
}

/** Sube un archivo al bucket público «media» y lo registra en la biblioteca. */
export async function uploadMedia(file: File, alt = ""): Promise<MediaAsset> {
  if (file.size > MAX_BYTES) throw new Error("El archivo supera el límite de 20 MB.");
  if (!MEDIA_ACCEPT.split(",").includes(file.type)) throw new Error("Formato no permitido.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "archivo";
  const path = `${new Date().toISOString().slice(0, 7)}/${base}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  const publicUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  const size = await imageSize(file);
  const { data, error: insErr } = await supabase
    .from("media_assets")
    .insert({ bucket: "media", path, public_url: publicUrl, kind: file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "document" : "image", mime_type: file.type, size_bytes: file.size, width: size?.width ?? null, height: size?.height ?? null, alt, title: file.name })
    .select("*")
    .single();
  if (insErr) {
    await supabase.storage.from("media").remove([path]);
    throw insErr;
  }
  return data as MediaAsset;
}

export function useMedia() {
  return useQuery({ queryKey: ["admin", "media"], queryFn: async () => ((await supabase.from("media_assets").select("*").order("created_at", { ascending: false }).limit(500)).data ?? []) as MediaAsset[] });
}

export function MediaThumb({ asset, className }: { asset: MediaAsset; className?: string }) {
  if (asset.kind === "image") return <img src={asset.public_url} alt={asset.alt} loading="lazy" className={cn("size-full object-cover", className)} />;
  if (asset.kind === "video") return <div className={cn("flex size-full items-center justify-center bg-white/5", className)}><Film className="size-6 text-muted" /></div>;
  return <div className={cn("flex size-full items-center justify-center bg-white/5", className)}><FileText className="size-6 text-muted" /></div>;
}

export function MediaPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (url: string, asset: MediaAsset) => void }) {
  const media = useMedia();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Biblioteca de medios" description="Elige un archivo o sube uno nuevo (máx. 20 MB)." size="lg">
      <div className="mb-4 flex items-center gap-3">
        <input
          ref={input}
          type="file"
          accept={MEDIA_ACCEPT}
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            setError(null);
            try {
              const asset = await uploadMedia(file);
              await qc.invalidateQueries({ queryKey: ["admin", "media"] });
              onSelect(asset.public_url, asset);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setUploading(false);
              if (input.current) input.current.value = "";
            }
          }}
        />
        <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-white" disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Subir archivo
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      {media.data?.length === 0 ? (
        <EmptyState title="La biblioteca está vacía" text="Sube tu primera imagen o vídeo." />
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {(media.data ?? []).map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onSelect(m.public_url, m)} className="group block w-full overflow-hidden rounded-sm border border-tone text-left hover:border-lavender">
                <div className="aspect-square">
                  <MediaThumb asset={m} />
                </div>
                <p className="truncate px-2 py-1.5 text-xs text-muted">{m.title || m.path}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
