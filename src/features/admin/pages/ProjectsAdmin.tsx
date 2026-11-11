import { useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { cn, formatDate, formatDateTime, slugify, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Badge, ErrorState, Skeleton, useToast } from "@/components/ui/feedback";
import { Modal, useConfirm } from "@/components/ui/overlay";
import { AdminPage, Card, DataTable } from "../components/ui";
import { useStaff } from "../hooks";

const STATUS: Record<string, { label: string; tone: "info" | "violet" | "warning" | "success" | "neutral" | "danger" }> = {
  planning: { label: "Planificación", tone: "info" },
  in_progress: { label: "En desarrollo", tone: "violet" },
  review: { label: "En revisión", tone: "warning" },
  completed: { label: "Completado", tone: "success" },
  paused: { label: "En pausa", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "danger" },
};
const TASK_STATUS: Record<string, string> = { todo: "Pendiente", in_progress: "En curso", blocked: "Bloqueada", done: "Hecha" };

interface ProjectRow {
  id: string;
  customer_id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  visible_to_client: boolean;
  updated_at: string;
  customers: { name: string } | null;
}

export default function ProjectsAdmin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const customerFilter = params.get("cliente");
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "customer_projects", customerFilter],
    queryFn: async () => {
      let query = supabase.from("customer_projects").select("*, customers(name)").order("updated_at", { ascending: false });
      if (customerFilter) query = query.eq("customer_id", customerFilter);
      return ((await query).data ?? []) as ProjectRow[];
    },
  });
  return (
    <AdminPage
      title="Proyectos de clientes"
      description="Proyectos visibles en el portal de cada cliente, con fases, tareas, archivos y novedades."
      actions={
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
          Nuevo proyecto
        </Button>
      }
    >
      <DataTable
        rows={q.data}
        loading={q.isLoading}
        error={q.error}
        searchKeys={["name", (r) => r.customers?.name ?? ""]}
        onRowClick={(r) => navigate(`/admin/proyectos/${r.id}`)}
        empty="Todavía no hay proyectos de clientes."
        columns={[
          { key: "name", label: "Proyecto", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "customer", label: "Cliente", render: (r) => r.customers?.name ?? "—" },
          { key: "status", label: "Estado", render: (r) => <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge> },
          { key: "progress", label: "Progreso", hideOnMobile: true, sortValue: (r) => r.progress, render: (r) => `${r.progress} %` },
          { key: "due_date", label: "Entrega", hideOnMobile: true, render: (r) => <span className={cn(r.due_date && new Date(r.due_date) < new Date() && !["completed", "cancelled"].includes(r.status) && "text-danger")}>{formatDate(r.due_date)}</span> },
          { key: "visible", label: "Portal", hideOnMobile: true, render: (r) => (r.visible_to_client ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4 text-muted" />) },
        ]}
      />
      <NewProject open={creating} onClose={() => setCreating(false)} defaultCustomer={customerFilter} onCreated={(id) => navigate(`/admin/proyectos/${id}`)} />
    </AdminPage>
  );
}

function NewProject({ open, onClose, onCreated, defaultCustomer }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; defaultCustomer: string | null }) {
  const toast = useToast();
  const customers = useQuery({ queryKey: ["admin", "customers-options"], queryFn: async () => ((await supabase.from("customers").select("id, name").order("name")).data ?? []) as { id: string; name: string }[], enabled: open });
  const [f, setF] = useState({ customer_id: defaultCustomer ?? "", name: "", description: "", start_date: "", due_date: "", phases: true });
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("customer_projects").insert({ customer_id: f.customer_id, name: f.name, description: f.description, start_date: f.start_date || null, due_date: f.due_date || null }).select("id").single();
      if (error) throw error;
      if (f.phases) {
        await supabase.from("project_phases").insert(["Descubrimiento", "Diseño", "Desarrollo", "Pruebas", "Entrega"].map((name, position) => ({ project_id: data.id, name, position, status: position === 0 ? "active" : "pending" })));
      }
      return data.id as string;
    },
    onSuccess: (id) => {
      onClose();
      onCreated(id);
    },
    onError: (e) => toast("error", "No se pudo crear", errorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Nuevo proyecto" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={create.isPending} disabled={!f.customer_id || !f.name} onClick={() => create.mutate()}>Crear</Button></>}>
      <div className="grid gap-3">
        <Select label="Cliente" value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value })} placeholder="Selecciona…" options={(customers.data ?? []).map((c) => ({ value: c.id, label: c.name }))} hint={customers.data?.length === 0 ? "Primero crea un cliente (o convierte un lead)." : undefined} />
        <Input label="Nombre del proyecto" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Textarea label="Descripción" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Inicio" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
          <Input label="Entrega prevista" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>
        <Checkbox checked={f.phases} onChange={(v) => setF({ ...f, phases: v })} label="Crear fases estándar (Descubrimiento → Entrega)" />
      </div>
    </Modal>
  );
}

export function ProjectEditor() {
  const { id = "" } = useParams();
  const toast = useToast();
  const qc = useQueryClient();
  const staff = useStaff();
  const { confirm, dialog } = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [edit, setEdit] = useState<Partial<ProjectRow>>({});
  const [newTask, setNewTask] = useState({ title: "", phase_id: "", visible_to_client: true });
  const [newPhase, setNewPhase] = useState("");
  const [update, setUpdate] = useState({ body: "", visible_to_client: true });
  const key = ["admin", "project", id];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [p, phases, tasks, files, updates] = await Promise.all([
        supabase.from("customer_projects").select("*, customers(name, user_id)").eq("id", id).single(),
        supabase.from("project_phases").select("*").eq("project_id", id).order("position"),
        supabase.from("project_tasks").select("*").eq("project_id", id).order("position").order("created_at"),
        supabase.from("project_files").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        supabase.from("project_updates").select("*, profiles(email)").eq("project_id", id).order("created_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      return { project: p.data as ProjectRow & { customers: { name: string; user_id: string | null } | null }, phases: phases.data ?? [], tasks: tasks.data ?? [], files: files.data ?? [], updates: (updates.data ?? []) as { id: string; body: string; visible_to_client: boolean; created_at: string; profiles: { email: string } | null }[] };
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => {
    const { error } = await fn();
    if (error) toast("error", "No se pudo completar", errorMessage(error));
    else if (ok) toast("success", ok);
    refresh();
  };

  if (q.isLoading) return <AdminPage title="Proyecto"><Skeleton className="h-96" /></AdminPage>;
  if (q.error || !q.data) return <AdminPage title="Proyecto"><ErrorState error={q.error} /></AdminPage>;
  const { project, phases, tasks, files, updates } = q.data;
  const p = { ...project, ...edit };

  return (
    <AdminPage
      title={project.name}
      description={`Cliente: ${project.customers?.name ?? "—"} · ${project.customers?.user_id ? "con acceso al portal" : "sin cuenta en el portal"}`}
      actions={
        <Link to="/admin/proyectos" className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--tone-fg)]">
          <ArrowLeft className="size-4" /> Proyectos
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Datos del proyecto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nombre" value={p.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <Select label="Estado" value={p.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
              <Input label="Inicio" type="date" value={p.start_date ?? ""} onChange={(e) => setEdit({ ...edit, start_date: e.target.value || null })} />
              <Input label="Entrega prevista" type="date" value={p.due_date ?? ""} onChange={(e) => setEdit({ ...edit, due_date: e.target.value || null })} />
              <Input label="Progreso (%)" type="number" min={0} max={100} value={p.progress} onChange={(e) => setEdit({ ...edit, progress: Math.max(0, Math.min(100, Number(e.target.value))) })} />
              <div className="flex items-end pb-2">
                <Checkbox checked={p.visible_to_client} onChange={(v) => setEdit({ ...edit, visible_to_client: v })} label="Visible en el portal del cliente" />
              </div>
              <Textarea label="Descripción" wrapperClassName="sm:col-span-2" value={p.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </div>
            {Object.keys(edit).length > 0 && (
              <Button
                className="mt-4"
                size="sm"
                onClick={() =>
                  void run(async () => {
                    const r = await supabase.from("customer_projects").update(edit).eq("id", id);
                    if (!r.error) setEdit({});
                    return r;
                  }, "Proyecto actualizado")
                }
              >
                Guardar
              </Button>
            )}
          </Card>

          <Card title="Fases">
            <ol className="space-y-2">
              {phases.map((ph) => (
                <li key={ph.id} className="flex items-center gap-3 rounded-sm border border-tone p-2.5 text-sm">
                  <span className="flex-1">{ph.name}</span>
                  <select className="h-8 rounded-sm border border-tone bg-white/[0.04] px-2 text-xs" value={ph.status} onChange={(e) => void run(() => supabase.from("project_phases").update({ status: e.target.value }).eq("id", ph.id))} aria-label={`Estado de ${ph.name}`}>
                    <option value="pending">Pendiente</option>
                    <option value="active">En curso</option>
                    <option value="done">Completada</option>
                  </select>
                  <button className="rounded p-1 text-muted hover:text-danger" aria-label="Eliminar fase" onClick={async () => (await confirm("¿Eliminar la fase?", { danger: true, confirmLabel: "Eliminar" })) && void run(() => supabase.from("project_phases").delete().eq("id", ph.id))}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPhase.trim()) return;
                void run(() => supabase.from("project_phases").insert({ project_id: id, name: newPhase.trim(), position: phases.length }));
                setNewPhase("");
              }}
            >
              <input className="h-9 flex-1 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" placeholder="Nueva fase" value={newPhase} onChange={(e) => setNewPhase(e.target.value)} aria-label="Nueva fase" />
              <Button size="sm" type="submit" variant="outline">
                Añadir
              </Button>
            </form>
          </Card>

          <Card title="Tareas">
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-sm border border-tone p-2.5 text-sm">
                  <span className={cn("min-w-40 flex-1", t.status === "done" && "text-muted line-through")}>{t.title}</span>
                  <select className="h-8 rounded-sm border border-tone bg-white/[0.04] px-2 text-xs" value={t.status} onChange={(e) => void run(() => supabase.from("project_tasks").update({ status: e.target.value }).eq("id", t.id))} aria-label="Estado de la tarea">
                    {Object.entries(TASK_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select className="h-8 max-w-36 rounded-sm border border-tone bg-white/[0.04] px-2 text-xs" value={t.assignee_id ?? ""} onChange={(e) => void run(() => supabase.from("project_tasks").update({ assignee_id: e.target.value || null }).eq("id", t.id))} aria-label="Responsable">
                    <option value="">Sin asignar</option>
                    {(staff.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </select>
                  <button className="rounded p-1 text-muted hover:bg-white/10" title={t.visible_to_client ? "Visible para el cliente" : "Solo interna"} aria-label="Cambiar visibilidad" onClick={() => void run(() => supabase.from("project_tasks").update({ visible_to_client: !t.visible_to_client }).eq("id", t.id))}>
                    {t.visible_to_client ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4" />}
                  </button>
                  <button className="rounded p-1 text-muted hover:text-danger" aria-label="Eliminar tarea" onClick={() => void run(() => supabase.from("project_tasks").delete().eq("id", t.id))}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTask.title.trim()) return;
                void run(() => supabase.from("project_tasks").insert({ project_id: id, title: newTask.title.trim(), phase_id: newTask.phase_id || null, visible_to_client: newTask.visible_to_client, position: tasks.length }));
                setNewTask({ ...newTask, title: "" });
              }}
            >
              <input className="h-9 min-w-40 flex-1 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" placeholder="Nueva tarea" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} aria-label="Nueva tarea" />
              <select className="h-9 rounded-sm border border-tone bg-white/[0.04] px-2 text-sm" value={newTask.phase_id} onChange={(e) => setNewTask({ ...newTask, phase_id: e.target.value })} aria-label="Fase">
                <option value="">Sin fase</option>
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={newTask.visible_to_client} onChange={(e) => setNewTask({ ...newTask, visible_to_client: e.target.checked })} className="accent-[var(--nv-primary)]" /> Visible
              </label>
              <Button size="sm" type="submit" variant="outline">
                Añadir
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Archivos"
            description="Bucket privado: solo el equipo y el cliente del proyecto pueden descargarlos."
            actions={
              <>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 50 * 1024 * 1024) return toast("error", "Archivo demasiado grande", "Máximo 50 MB.");
                    setUploading(true);
                    const path = `${id}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, "")) || "archivo"}.${file.name.split(".").pop()?.toLowerCase() ?? "bin"}`;
                    const up = await supabase.storage.from("project-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
                    if (up.error) toast("error", "No se pudo subir", errorMessage(up.error));
                    else await run(() => supabase.from("project_files").insert({ project_id: id, storage_path: path, file_name: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size }), "Archivo subido");
                    setUploading(false);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                />
                <Button size="sm" variant="outline" icon={uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} onClick={() => fileInput.current?.click()} disabled={uploading}>
                  Subir
                </Button>
              </>
            }
          >
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-sm border border-tone p-2.5 text-sm">
                  <FileText className="size-4 shrink-0 text-lavender" />
                  <button
                    className="min-w-0 flex-1 truncate text-left hover:underline"
                    onClick={async () => {
                      const { data, error } = await supabase.storage.from("project-files").createSignedUrl(f.storage_path, 60, { download: f.file_name });
                      if (error || !data) toast("error", "No se pudo descargar", errorMessage(error));
                      else window.open(data.signedUrl, "_blank", "noopener");
                    }}
                  >
                    {f.file_name}
                  </button>
                  <button className="rounded p-1 hover:bg-white/10" title={f.visible_to_client ? "Visible para el cliente" : "Solo interno"} aria-label="Cambiar visibilidad" onClick={() => void run(() => supabase.from("project_files").update({ visible_to_client: !f.visible_to_client }).eq("id", f.id))}>
                    {f.visible_to_client ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4 text-muted" />}
                  </button>
                  <button
                    className="rounded p-1 text-muted hover:text-danger"
                    aria-label="Eliminar archivo"
                    onClick={async () => {
                      if (!(await confirm("¿Eliminar el archivo?", { danger: true, confirmLabel: "Eliminar" }))) return;
                      await supabase.storage.from("project-files").remove([f.storage_path]);
                      await run(() => supabase.from("project_files").delete().eq("id", f.id), "Archivo eliminado");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
              {files.length === 0 && <li className="text-sm text-muted">Sin archivos.</li>}
            </ul>
          </Card>
          <Card title="Novedades e historial" description="Las novedades visibles se notifican al cliente en su portal.">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!update.body.trim()) return;
                void run(() => supabase.from("project_updates").insert({ project_id: id, body: update.body.trim(), visible_to_client: update.visible_to_client }), update.visible_to_client ? "Novedad publicada y notificada" : "Nota interna guardada");
                setUpdate({ ...update, body: "" });
              }}
            >
              <textarea className="min-h-20 w-full rounded-sm border border-tone bg-white/[0.04] p-3 text-sm" placeholder="Escribe una novedad o nota…" value={update.body} onChange={(e) => setUpdate({ ...update, body: e.target.value })} maxLength={4000} aria-label="Novedad" />
              <div className="flex items-center justify-between">
                <Checkbox checked={update.visible_to_client} onChange={(v) => setUpdate({ ...update, visible_to_client: v })} label="Visible para el cliente" />
                <Button size="sm" type="submit">
                  Publicar
                </Button>
              </div>
            </form>
            <ul className="mt-4 space-y-3">
              {updates.map((u) => (
                <li key={u.id} className="rounded-sm border border-tone p-3">
                  <p className="whitespace-pre-line text-sm">{u.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {u.profiles?.email ?? "—"} · {timeAgo(u.created_at)} · {u.visible_to_client ? "visible para el cliente" : "interna"}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Última actualización del proyecto: {formatDateTime(project.updated_at)}</p>
          </Card>
        </div>
      </div>
      {dialog}
    </AdminPage>
  );
}
