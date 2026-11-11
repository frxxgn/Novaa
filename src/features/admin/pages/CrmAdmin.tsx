import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, KanbanSquare, List, Mail, MessageCircle, Phone, Plus, UserCheck } from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { downloadApi, errorMessage } from "@/lib/api";
import { cn, formatDateTime, money, timeAgo, whatsappLink } from "@/lib/utils";
import { PROJECT_TYPE_LABELS, PROJECT_TYPES } from "@/shared/pricing";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Badge, ErrorState, Skeleton, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { QuoteCard } from "@/features/nova/QuoteCard";
import { rowToQuote } from "@/features/nova/useNova";
import { AdminPage, Card, DataTable } from "../components/ui";
import { useStaff } from "../hooks";
import { SOURCE_LABEL, STATUS_LABEL } from "./Dashboard";

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp_opt_in: boolean;
  project_type: string;
  needs: string;
  budget_range: string;
  timeline: string;
  estimated_min: number | null;
  estimated_max: number | null;
  quote_id: string | null;
  conversation_id: string | null;
  user_id: string | null;
  source: string;
  source_detail: string;
  status: "new" | "contacted" | "negotiation" | "won" | "lost";
  assigned_to: string | null;
  lost_reason: string;
  final_value: number | null;
  consent_at: string | null;
  consent_version: string;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
}

const STATUSES = ["new", "contacted", "negotiation", "won", "lost"] as const;
const STATUS_TONE: Record<string, "info" | "violet" | "warning" | "success" | "danger"> = { new: "info", contacted: "violet", negotiation: "warning", won: "success", lost: "danger" };

export default function CrmAdmin() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const staff = useStaff();
  const [view, setView] = useState<"list" | "board">("list");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "leads"], queryFn: async () => ((await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(2000)).data ?? []) as Lead[] });
  const staffName = (id: string | null) => staff.data?.find((s) => s.id === id)?.full_name || staff.data?.find((s) => s.id === id)?.email || "—";

  const rows = (q.data ?? []).filter((l) => (status === "all" || l.status === status) && (source === "all" || l.source === source) && (assignee === "all" || (assignee === "none" ? !l.assigned_to : l.assigned_to === assignee)));

  const move = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) => {
      const { error } = await supabase.from("leads").update({ status: to }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, to }) => {
      qc.setQueryData<Lead[]>(["admin", "leads"], (old) => old?.map((l) => (l.id === id ? { ...l, status: to as Lead["status"] } : l)));
    },
    onError: (e) => {
      toast("error", "No se pudo mover", errorMessage(e));
      void qc.invalidateQueries({ queryKey: ["admin", "leads"] });
    },
  });

  return (
    <AdminPage
      title="CRM · Leads"
      description="Oportunidades comerciales captadas por Nova, formularios, presupuestos y plantillas."
      actions={
        <>
          <div className="flex rounded-full border border-tone p-0.5">
            <button onClick={() => setView("list")} className={cn("rounded-full p-1.5", view === "list" ? "bg-white text-ink" : "text-muted")} aria-label="Lista">
              <List className="size-4" />
            </button>
            <button onClick={() => setView("board")} className={cn("rounded-full p-1.5", view === "board" ? "bg-white text-ink" : "text-muted")} aria-label="Tablero">
              <KanbanSquare className="size-4" />
            </button>
          </div>
          {can("crm.export") && (
            <Button size="sm" variant="outline" icon={<Download className="size-4" />} onClick={() => downloadApi(`/admin/leads/export${status !== "all" ? `?status=${status}` : ""}`, "leads.csv").catch((e) => toast("error", "No se pudo exportar", errorMessage(e)))}>
              Exportar CSV
            </Button>
          )}
          {can("crm.write") && (
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Nuevo lead
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="h-10 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="all">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Origen">
          <option value="all">Todos los orígenes</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Responsable">
          <option value="all">Todos los responsables</option>
          <option value="none">Sin asignar</option>
          {(staff.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.email}
            </option>
          ))}
        </select>
      </div>

      {view === "list" ? (
        <DataTable
          rows={rows}
          loading={q.isLoading}
          error={q.error}
          searchKeys={["name", "company", "email", "needs", "phone"]}
          searchPlaceholder="Buscar por nombre, empresa, correo…"
          empty="No hay leads con estos filtros."
          onRowClick={(r) => navigate(`/admin/crm/${r.id}`)}
          initialSort={{ key: "created_at", dir: "desc" }}
          columns={[
            { key: "name", label: "Contacto", render: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-xs text-muted">{r.company || r.email}</span></span> },
            { key: "status", label: "Estado", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
            { key: "project_type", label: "Proyecto", hideOnMobile: true, render: (r) => PROJECT_TYPE_LABELS[r.project_type as keyof typeof PROJECT_TYPE_LABELS] ?? (r.project_type || "—") },
            { key: "estimate", label: "Estimación", hideOnMobile: true, sortValue: (r) => Number(r.estimated_max ?? 0), render: (r) => (r.estimated_min !== null ? `${money(r.estimated_min)} – ${money(r.estimated_max)}` : "—") },
            { key: "source", label: "Origen", hideOnMobile: true, render: (r) => SOURCE_LABEL[r.source] ?? r.source },
            { key: "assigned_to", label: "Responsable", hideOnMobile: true, render: (r) => staffName(r.assigned_to) },
            { key: "created_at", label: "Fecha", sortValue: (r) => r.created_at, render: (r) => <span className="text-muted">{timeAgo(r.created_at)}</span> },
          ]}
        />
      ) : q.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {STATUSES.map((s) => {
            const items = rows.filter((l) => l.status === s);
            return (
              <div
                key={s}
                className={cn("flex w-72 shrink-0 flex-col rounded-md border border-tone p-3", dragging && "border-dashed")}
                style={{ background: "color-mix(in oklab, var(--nv-surface-dark) 60%, transparent)" }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging && can("crm.write")) move.mutate({ id: dragging, to: s });
                  setDragging(null);
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge>
                  <span className="text-xs text-muted">{items.length}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((l) => (
                    <li key={l.id} draggable={can("crm.write")} onDragStart={() => setDragging(l.id)} onDragEnd={() => setDragging(null)}>
                      <Link to={`/admin/crm/${l.id}`} className="block rounded-sm border border-tone bg-white/[0.04] p-3 hover:border-lavender">
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="truncate text-xs text-muted">{l.company || l.email}</p>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-lavender">{l.estimated_min !== null ? `${money(l.estimated_min)}–${money(l.estimated_max)}` : SOURCE_LABEL[l.source]}</span>
                          <span className="text-muted">{timeAgo(l.created_at)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <NewLeadModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => navigate(`/admin/crm/${id}`)} />
    </AdminPage>
  );
}

function NewLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", project_type: "", needs: "" });
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("leads").insert({ ...f, source: "manual" }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      onClose();
      onCreated(id);
    },
    onError: (e) => toast("error", "No se pudo crear", errorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Nuevo lead manual" description="Registra un contacto recibido por otro canal (teléfono, evento…). Asegúrate de contar con su consentimiento." footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={create.isPending} onClick={() => create.mutate()} disabled={!f.name || !f.email}>Crear</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nombre" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Empresa" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
        <Input label="Correo" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Teléfono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Select label="Tipo de proyecto" wrapperClassName="sm:col-span-2" value={f.project_type} onChange={(e) => setF({ ...f, project_type: e.target.value })} placeholder="—" options={PROJECT_TYPES.map((p) => ({ value: p, label: PROJECT_TYPE_LABELS[p] }))} />
        <Textarea label="Necesidades" wrapperClassName="sm:col-span-2" value={f.needs} onChange={(e) => setF({ ...f, needs: e.target.value })} />
      </div>
    </Modal>
  );
}

export function LeadDetail() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const staff = useStaff();
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState<Partial<Lead>>({});

  const q = useQuery({
    queryKey: ["admin", "lead", id],
    queryFn: async () => {
      const [lead, notes, events, quote] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).single(),
        supabase.from("lead_notes").select("id, body, created_at, author_id, profiles(email, full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("lead_events").select("id, type, data, created_at, profiles(email, full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("quotes").select("*, quote_items(*)").eq("lead_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (lead.error) throw lead.error;
      return {
        lead: lead.data as Lead,
        notes: (notes.data ?? []) as unknown as { id: string; body: string; created_at: string; profiles: { email: string; full_name: string } | null }[],
        events: (events.data ?? []) as unknown as { id: number; type: string; data: Record<string, string>; created_at: string; profiles: { email: string; full_name: string } | null }[],
        quote: quote.data,
      };
    },
  });
  const customer = useQuery({ queryKey: ["admin", "lead-customer", id], queryFn: async () => (await supabase.from("customers").select("id, name").eq("lead_id", id).maybeSingle()).data, enabled: can("customers.manage") });

  const update = useMutation({
    mutationFn: async (patch: Partial<Lead>) => {
      const { error } = await supabase.from("leads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEdit({});
      toast("success", "Lead actualizado");
      void qc.invalidateQueries({ queryKey: ["admin", "lead", id] });
      void qc.invalidateQueries({ queryKey: ["admin", "leads"] });
    },
    onError: (e) => toast("error", "No se pudo actualizar", errorMessage(e)),
  });
  const addNote = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("lead_notes").insert({ lead_id: id, body: note.trim(), author_id: u.user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin", "lead", id] });
    },
    onError: (e) => toast("error", "No se pudo guardar la nota", errorMessage(e)),
  });
  const convert = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("convert_lead_to_customer", { p_lead_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast("success", "Cliente creado", "El lead se ha marcado como ganado.");
      void qc.invalidateQueries({ queryKey: ["admin", "lead", id] });
      void qc.invalidateQueries({ queryKey: ["admin", "lead-customer", id] });
    },
    onError: (e) => toast("error", "No se pudo convertir", errorMessage(e)),
  });

  if (q.isLoading) return <AdminPage title="Lead"><Skeleton className="h-96" /></AdminPage>;
  if (q.error || !q.data) return <AdminPage title="Lead"><ErrorState error={q.error} /></AdminPage>;
  const { lead, notes, events, quote } = q.data;
  const l = { ...lead, ...edit };
  const writable = can("crm.write");

  return (
    <AdminPage
      title={lead.name}
      description={`${lead.company ? `${lead.company} · ` : ""}${SOURCE_LABEL[lead.source] ?? lead.source}${lead.source_detail ? ` (${lead.source_detail})` : ""} · ${formatDateTime(lead.created_at)}`}
      actions={
        <>
          <button onClick={() => navigate("/admin/crm")} className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--tone-fg)]">
            <ArrowLeft className="size-4" /> CRM
          </button>
          {can("customers.manage") && writable && (customer.data ? (
            <Link to="/admin/clientes" className="text-sm text-lavender underline">Cliente: {customer.data.name}</Link>
          ) : (
            <Button size="sm" icon={<UserCheck className="size-4" />} loading={convert.isPending} onClick={() => convert.mutate()}>
              Convertir en cliente
            </Button>
          ))}
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Datos de contacto">
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 rounded-full border border-tone px-3 py-1.5 text-sm hover:bg-white/5">
                <Mail className="size-4" /> {lead.email}
              </a>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-tone px-3 py-1.5 text-sm hover:bg-white/5">
                  <Phone className="size-4" /> {lead.phone}
                </a>
              )}
              {lead.phone && lead.whatsapp_opt_in && (
                <a href={whatsappLink(lead.phone, `Hola ${lead.name.split(" ")[0]}, te escribimos de Novalius.`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-tone px-3 py-1.5 text-sm hover:bg-white/5">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">
              Consentimiento: {lead.consent_at ? `${formatDateTime(lead.consent_at)} (política ${lead.consent_version || "—"})` : "registrado manualmente"} · WhatsApp: {lead.whatsapp_opt_in ? "autorizado" : "no autorizado"}
            </p>
            <fieldset disabled={!writable} className="mt-5 grid gap-3 sm:grid-cols-2">
              <Input label="Nombre" value={l.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <Input label="Empresa" value={l.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} />
              <Input label="Teléfono" value={l.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              <Select label="Tipo de proyecto" value={l.project_type} onChange={(e) => setEdit({ ...edit, project_type: e.target.value })} placeholder="—" options={PROJECT_TYPES.map((p) => ({ value: p, label: PROJECT_TYPE_LABELS[p] }))} />
              <Input label="Presupuesto indicado" value={l.budget_range} onChange={(e) => setEdit({ ...edit, budget_range: e.target.value })} />
              <Input label="Plazo" value={l.timeline} onChange={(e) => setEdit({ ...edit, timeline: e.target.value })} />
              <Textarea label="Necesidades" wrapperClassName="sm:col-span-2" rows={5} value={l.needs} onChange={(e) => setEdit({ ...edit, needs: e.target.value })} />
            </fieldset>
            {writable && Object.keys(edit).length > 0 && (
              <Button className="mt-4" size="sm" loading={update.isPending} onClick={() => update.mutate(edit)}>
                Guardar cambios
              </Button>
            )}
          </Card>
          <Card title="Notas">
            {writable && (
              <div className="mb-4 flex gap-2">
                <textarea className="min-h-20 flex-1 rounded-sm border border-tone bg-white/[0.04] p-3 text-sm" placeholder="Añade una nota interna…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nueva nota" maxLength={4000} />
                <Button size="sm" onClick={() => addNote.mutate()} disabled={!note.trim()} loading={addNote.isPending}>
                  Añadir
                </Button>
              </div>
            )}
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-sm border border-tone p-3">
                  <p className="whitespace-pre-line text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {n.profiles?.full_name || n.profiles?.email || "—"} · {timeAgo(n.created_at)}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-sm text-muted">Sin notas.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Estado comercial">
            <fieldset disabled={!writable} className="grid gap-3">
              <Select label="Estado" value={l.status} onChange={(e) => update.mutate({ status: e.target.value as Lead["status"] })} options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s]! }))} />
              <Select label="Responsable" value={l.assigned_to ?? ""} onChange={(e) => update.mutate({ assigned_to: e.target.value || null })} placeholder="Sin asignar" options={(staff.data ?? []).map((s) => ({ value: s.id, label: s.full_name || s.email }))} />
              {l.status === "lost" && <Input label="Motivo de pérdida" value={l.lost_reason} onChange={(e) => setEdit({ ...edit, lost_reason: e.target.value })} />}
              {l.status === "won" && <Input label="Importe final (€)" type="number" value={l.final_value ?? ""} onChange={(e) => setEdit({ ...edit, final_value: e.target.value ? Number(e.target.value) : null })} />}
            </fieldset>
          </Card>
          {quote ? (
            <div>
              <p className="mb-2 text-sm font-medium">Presupuesto asociado</p>
              <QuoteCard quote={rowToQuote(quote)} />
            </div>
          ) : lead.estimated_min !== null ? (
            <Card title="Estimación">
              {money(lead.estimated_min)} – {money(lead.estimated_max)}
            </Card>
          ) : null}
          {lead.conversation_id && can("nova.conversations.read") && (
            <Card title="Conversación con Nova">
              <Link to={`/admin/nova/conversaciones/${lead.conversation_id}`} className="text-sm text-lavender underline">
                Ver conversación completa
              </Link>
            </Card>
          )}
          <Card title="Historial">
            <ol className="space-y-3 text-sm">
              {events.map((e) => (
                <li key={e.id} className="border-l border-tone pl-3">
                  <p>
                    {e.type === "created" && "Lead creado"}
                    {e.type === "status_changed" && `Estado: ${STATUS_LABEL[e.data.from ?? ""] ?? e.data.from} → ${STATUS_LABEL[e.data.to ?? ""] ?? e.data.to}`}
                    {e.type === "assigned" && `Responsable: ${e.data.to ? staff.data?.find((s) => s.id === e.data.to)?.email ?? "asignado" : "sin asignar"}`}
                    {e.type === "note" && "Nota añadida"}
                    {e.type === "updated" && "Datos actualizados"}
                    {e.type === "converted" && "Convertido en cliente"}
                  </p>
                  <p className="text-xs text-muted">
                    {e.profiles?.email ?? "Sistema"} · {formatDateTime(e.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
