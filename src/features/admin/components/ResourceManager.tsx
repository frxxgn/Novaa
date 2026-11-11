// Gestor CRUD genérico sobre una tabla de Supabase (protegida por RLS).
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { useAuth } from "@/app/auth";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/feedback";
import { Drawer, useConfirm } from "@/components/ui/overlay";
import { DataTable, type Column } from "./ui";
import { FormFields, type AdminField } from "./FormFields";

type Row = Record<string, unknown> & { id: string };

export interface ResourceConfig {
  table: string;
  permission: string;
  title: string;
  singular: string;
  fields: AdminField[];
  columns: Column<Row>[];
  defaults: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean }[];
  filter?: { column: string; value: string | boolean | null };
  searchKeys?: string[];
  orderable?: boolean;
  visibilityField?: "is_published" | "is_visible" | "is_active";
  slugFrom?: string;
  select?: string;
  /** Prepara los datos antes de guardar (p. ej. limpiar campos derivados). */
  beforeSave?: (row: Record<string, unknown>) => Record<string, unknown>;
  afterSave?: () => void;
  rowActions?: (row: Row) => ReactNode;
  toolbar?: ReactNode;
  duplicable?: boolean;
  deletable?: boolean;
  emptyText?: string;
}

export function useResource(cfg: Pick<ResourceConfig, "table" | "orderBy" | "filter" | "select">) {
  return useQuery({
    queryKey: ["admin", cfg.table, cfg.filter?.column, cfg.filter?.value],
    queryFn: async () => {
      let q = supabase.from(cfg.table).select(cfg.select ?? "*");
      if (cfg.filter) q = cfg.filter.value === null ? q.is(cfg.filter.column, null) : q.eq(cfg.filter.column, cfg.filter.value);
      for (const o of cfg.orderBy ?? [{ column: "created_at", ascending: false }]) q = q.order(o.column, { ascending: o.ascending ?? true });
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
}

export function ResourceManager({ config: cfg }: { config: ResourceConfig }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const list = useResource(cfg);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const writable = can(cfg.permission);
  const key = ["admin", cfg.table];

  const save = useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      let data = { ...row };
      if (cfg.slugFrom && !data.slug) data.slug = slugify(String(data[cfg.slugFrom] ?? ""));
      if (cfg.beforeSave) data = cfg.beforeSave(data);
      const { id, created_at: _c, updated_at: _u, ...rest } = data as Record<string, unknown> & { id?: string };
      void _c;
      void _u;
      if (id) {
        const { error } = await supabase.from(cfg.table).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        if (cfg.orderable && rest.position === undefined) rest.position = (list.data?.length ?? 0) + 1;
        const { error } = await supabase.from(cfg.table).insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast("success", "Guardado");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: key });
      cfg.afterSave?.();
    },
    onError: (e) => toast("error", "No se pudo guardar", errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(cfg.table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("success", "Eliminado");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: key });
      cfg.afterSave?.();
    },
    onError: (e) => toast("error", "No se pudo eliminar", errorMessage(e)),
  });

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from(cfg.table).update(values).eq("id", id);
    if (error) toast("error", "No se pudo actualizar", errorMessage(error));
    void qc.invalidateQueries({ queryKey: key });
    cfg.afterSave?.();
  };

  const move = async (row: Row, dir: -1 | 1) => {
    const rows = list.data ?? [];
    const i = rows.findIndex((r) => r.id === row.id);
    const other = rows[i + dir];
    if (!other) return;
    await Promise.all([patch(row.id, { position: other.position }), patch(other.id, { position: row.position })]);
  };

  const columns: Column<Row>[] = [
    ...cfg.columns,
    ...(writable && (cfg.orderable || cfg.visibilityField)
      ? [
          {
            key: "_actions",
            label: "",
            className: "w-px whitespace-nowrap text-right",
            render: (row: Row) => (
              <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                {cfg.rowActions?.(row)}
                {cfg.visibilityField && (
                  <button className="rounded p-1.5 text-muted hover:bg-white/10" onClick={() => patch(row.id, { [cfg.visibilityField!]: !row[cfg.visibilityField!] })} aria-label={row[cfg.visibilityField] ? "Ocultar" : "Mostrar"} title={row[cfg.visibilityField] ? "Ocultar" : "Mostrar"}>
                    {row[cfg.visibilityField] ? <Eye className="size-4" /> : <EyeOff className="size-4 text-warning" />}
                  </button>
                )}
                {cfg.orderable && (
                  <>
                    <button className="rounded p-1.5 text-muted hover:bg-white/10" onClick={() => move(row, -1)} aria-label="Subir">
                      <ArrowUp className="size-4" />
                    </button>
                    <button className="rounded p-1.5 text-muted hover:bg-white/10" onClick={() => move(row, 1)} aria-label="Bajar">
                      <ArrowDown className="size-4" />
                    </button>
                  </>
                )}
              </span>
            ),
          } satisfies Column<Row>,
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        rows={list.data}
        loading={list.isLoading}
        error={list.error}
        columns={columns}
        searchKeys={cfg.searchKeys as (keyof Row)[] | undefined}
        empty={cfg.emptyText ?? `No hay ${cfg.title.toLowerCase()}.`}
        onRowClick={(row) => setEditing({ ...row })}
        toolbar={
          <>
            {cfg.toolbar}
            {writable && (
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing({ ...cfg.defaults })}>
                Añadir {cfg.singular}
              </Button>
            )}
          </>
        }
      />
      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Editar ${cfg.singular}` : `Nuevo ${cfg.singular}`}
        width="max-w-2xl"
        footer={
          writable && editing ? (
            <>
              {editing.id && cfg.deletable !== false && (
                <Button
                  variant="ghost"
                  className="mr-auto text-danger"
                  icon={<Trash2 className="size-4" />}
                  onClick={async () => {
                    if (await confirm(`¿Eliminar este ${cfg.singular}?`, { danger: true, text: "Esta acción no se puede deshacer.", confirmLabel: "Eliminar" })) remove.mutate(String(editing.id));
                  }}
                >
                  Eliminar
                </Button>
              )}
              {editing.id && cfg.duplicable !== false && (
                <Button
                  variant="ghost"
                  icon={<Copy className="size-4" />}
                  onClick={() => {
                    const { id: _id, ...rest } = editing;
                    void _id;
                    setEditing({ ...rest, ...(rest.slug ? { slug: `${rest.slug}-copia` } : {}) });
                  }}
                >
                  Duplicar
                </Button>
              )}
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button loading={save.isPending} onClick={() => save.mutate(editing)}>
                Guardar
              </Button>
            </>
          ) : undefined
        }
      >
        {editing && (
          <fieldset disabled={!writable} className="disabled:opacity-80">
            <FormFields fields={cfg.fields} value={editing} onChange={setEditing} />
          </fieldset>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
