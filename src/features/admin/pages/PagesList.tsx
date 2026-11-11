import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, FilePlus2, Trash2 } from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { slugify, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/form";
import { Badge, useToast } from "@/components/ui/feedback";
import { Modal, useConfirm } from "@/components/ui/overlay";
import { AdminPage, DataTable } from "../components/ui";

interface PageRow {
  id: string;
  path: string;
  title: string;
  kind: string;
  is_system: boolean;
  published_version_id: string | null;
  has_unpublished_changes: boolean;
  updated_at: string;
  page_versions: { version: number }[];
}

const KIND: Record<string, string> = { landing: "Landing", standard: "Estándar", legal: "Legal", system: "Sistema" };

export default function PagesList() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [creating, setCreating] = useState<{ title: string; path: string; kind: string; template: string; duplicateOf?: string } | null>(null);
  const q = useQuery({ queryKey: ["admin", "pages"], queryFn: async () => ((await supabase.from("pages").select("id, path, title, kind, is_system, published_version_id, has_unpublished_changes, updated_at, page_versions!page_versions_page_id_fkey(version)").order("path")).data ?? []) as unknown as PageRow[] });

  const create = useMutation({
    mutationFn: async () => {
      if (!creating) return;
      const path = creating.path.startsWith("/") ? creating.path : `/${creating.path}`;
      if (creating.duplicateOf) {
        const { data, error } = await supabase.rpc("duplicate_page", { p_page_id: creating.duplicateOf, p_path: path, p_title: creating.title });
        if (error) throw error;
        return data as string;
      }
      const { data, error } = await supabase.from("pages").insert({ path, title: creating.title, kind: creating.kind, seo: { title: creating.title, description: "" } }).select("id").single();
      if (error) throw error;
      const sections =
        creating.template === "blank"
          ? []
          : [
              { type: "page_header", label: "Cabecera", props: { eyebrow: "", title: creating.title, subtitle: "" }, style: { tone: "dark" } },
              { type: "rich_text", label: "Contenido", props: { title: "", notice: "", body: "## Apartado\nEscribe aquí el contenido de la página." }, style: { tone: "light" } },
              { type: "cta", label: "Llamada a la acción", props: { title: "¿Hablamos?", text: "", primary: { label: "Contactar", href: "/contacto" }, secondary: { label: "", href: "" } }, style: { tone: "dark" } },
            ];
      if (sections.length) {
        const { error: sErr } = await supabase.from("page_sections").insert(sections.map((s, i) => ({ ...s, page_id: data.id, position: i })));
        if (sErr) throw sErr;
      }
      return data.id as string;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["admin", "pages"] });
      setCreating(null);
      if (id) navigate(`/admin/paginas/${id}`);
    },
    onError: (e) => toast("error", "No se pudo crear la página", errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("success", "Página eliminada");
      void qc.invalidateQueries({ queryKey: ["admin", "pages"] });
    },
    onError: (e) => toast("error", "No se pudo eliminar", errorMessage(e)),
  });

  return (
    <AdminPage
      title="Páginas"
      description="Crea, edita y publica páginas con el editor visual. Los cambios se guardan como borrador hasta que los publicas."
      actions={
        can("content.manage") && (
          <Button icon={<FilePlus2 className="size-4" />} onClick={() => setCreating({ title: "", path: "/", kind: "standard", template: "standard" })}>
            Nueva página
          </Button>
        )
      }
    >
      <DataTable
        rows={q.data}
        loading={q.isLoading}
        error={q.error}
        searchKeys={["title", "path"]}
        onRowClick={(r) => navigate(`/admin/paginas/${r.id}`)}
        columns={[
          { key: "title", label: "Título", render: (r) => <span className="font-medium">{r.title}</span> },
          { key: "path", label: "Ruta", render: (r) => <code className="text-xs text-muted">{r.path}</code> },
          { key: "kind", label: "Tipo", hideOnMobile: true, render: (r) => KIND[r.kind] ?? r.kind },
          {
            key: "status",
            label: "Estado",
            render: (r) =>
              !r.published_version_id ? (
                <Badge tone="warning">Sin publicar</Badge>
              ) : r.has_unpublished_changes ? (
                <Badge tone="info">Borrador con cambios</Badge>
              ) : (
                <Badge tone="success">Publicada · v{Math.max(0, ...r.page_versions.map((v) => v.version))}</Badge>
              ),
          },
          { key: "updated_at", label: "Actualizada", hideOnMobile: true, render: (r) => <span className="text-muted">{timeAgo(r.updated_at)}</span> },
          {
            key: "actions",
            label: "",
            className: "w-px whitespace-nowrap text-right",
            render: (r) => (
              <span className="inline-flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                {r.published_version_id && (
                  <Link to={r.path} target="_blank" className="rounded p-1.5 text-muted hover:bg-white/10" aria-label="Ver publicada" title="Ver publicada">
                    <ExternalLink className="size-4" />
                  </Link>
                )}
                {can("content.manage") && (
                  <button className="rounded p-1.5 text-muted hover:bg-white/10" title="Duplicar" aria-label="Duplicar" onClick={() => setCreating({ title: `${r.title} (copia)`, path: `${r.path === "/" ? "/inicio" : r.path}-copia`, kind: r.kind, template: "blank", duplicateOf: r.id })}>
                    <Copy className="size-4" />
                  </button>
                )}
                {can("content.manage") && !r.is_system && (
                  <button
                    className="rounded p-1.5 text-muted hover:bg-danger/20 hover:text-danger"
                    title="Eliminar"
                    aria-label="Eliminar"
                    onClick={async () => {
                      if (await confirm(`¿Eliminar «${r.title}»?`, { danger: true, text: "Se eliminarán también sus versiones publicadas.", confirmLabel: "Eliminar" })) remove.mutate(r.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </span>
            ),
          },
        ]}
      />
      <Modal
        open={Boolean(creating)}
        onClose={() => setCreating(null)}
        title={creating?.duplicateOf ? "Duplicar página" : "Nueva página"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(null)}>
              Cancelar
            </Button>
            <Button loading={create.isPending} onClick={() => create.mutate()} disabled={!creating?.title || !creating?.path || creating.path === "/"}>
              Crear
            </Button>
          </>
        }
      >
        {creating && (
          <div className="grid gap-4">
            <Input label="Título" value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value, path: creating.duplicateOf ? creating.path : `/${slugify(e.target.value)}` })} />
            <Input label="Ruta" hint="Minúsculas, números y guiones. Ej.: /servicios-especiales" value={creating.path} onChange={(e) => setCreating({ ...creating, path: e.target.value.toLowerCase() })} />
            {!creating.duplicateOf && (
              <>
                <Select label="Tipo" value={creating.kind} onChange={(e) => setCreating({ ...creating, kind: e.target.value })} options={[{ value: "standard", label: "Estándar" }, { value: "landing", label: "Landing" }, { value: "legal", label: "Legal" }]} />
                <Select label="Punto de partida" value={creating.template} onChange={(e) => setCreating({ ...creating, template: e.target.value })} options={[{ value: "standard", label: "Cabecera + texto + llamada a la acción" }, { value: "blank", label: "Página en blanco" }]} />
              </>
            )}
          </div>
        )}
      </Modal>
      {dialog}
    </AdminPage>
  );
}
