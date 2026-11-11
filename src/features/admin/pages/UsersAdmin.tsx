import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Badge, Notice, Skeleton, useToast } from "@/components/ui/feedback";
import { Drawer, Modal, useConfirm } from "@/components/ui/overlay";
import { AdminPage, Card, DataTable, Tabs } from "../components/ui";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  company: string;
  is_disabled: boolean;
  created_at: string;
  user_roles: { role: string }[];
}

const ROLE_LABEL: Record<string, string> = { user: "Usuario", customer: "Cliente", team: "Equipo", admin: "Administrador" };
const ROLE_TONE: Record<string, "neutral" | "info" | "violet" | "success"> = { user: "neutral", customer: "info", team: "violet", admin: "success" };

export default function UsersAdmin() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"users" | "roles" | "privacy">("users");
  return (
    <AdminPage
      title="Usuarios y permisos"
      description="Roles validados en la base de datos (RLS). Nadie puede asignarse roles a sí mismo y solo un administrador gestiona administradores."
      tabs={<Tabs value={tab} onChange={setTab} items={[{ value: "users", label: "Usuarios" }, { value: "roles", label: "Roles y permisos" }, { value: "privacy", label: "Solicitudes de privacidad" }]} />}
    >
      {tab === "users" && <UsersTab />}
      {tab === "roles" && <RolesMatrix editable={isAdmin} />}
      {tab === "privacy" && <PrivacyRequests />}
    </AdminPage>
  );
}

function UsersTab() {
  const { user: me, isAdmin } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [invite, setInvite] = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: async () => ((await supabase.from("profiles").select("id, email, full_name, company, is_disabled, created_at, user_roles(role)").order("created_at", { ascending: false }).limit(2000)).data ?? []) as unknown as UserRow[] });
  const activity = useQuery({ queryKey: ["admin", "user-activity", selected?.id], queryFn: async () => ((await supabase.from("audit_logs").select("id, action, entity, created_at").eq("actor_id", selected!.id).order("created_at", { ascending: false }).limit(20)).data ?? []) as { id: number; action: string; entity: string; created_at: string }[], enabled: Boolean(selected) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    void qc.invalidateQueries({ queryKey: ["admin", "staff"] });
  };
  const sendInvite = useMutation({
    mutationFn: () => api<{ invited: boolean }>("/admin/users/invite", { body: invite }),
    onSuccess: (r) => {
      toast("success", r.invited ? "Invitación enviada" : "Rol asignado a la cuenta existente");
      setInvite(null);
      refresh();
    },
    onError: (e) => toast("error", "No se pudo invitar", errorMessage(e)),
  });
  const toggleRole = async (u: UserRow, role: string, on: boolean) => {
    const { error } = on ? await supabase.from("user_roles").insert({ user_id: u.id, role }) : await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", role);
    if (error) toast("error", "No se pudo cambiar el rol", errorMessage(error));
    else {
      toast("success", on ? `Rol ${ROLE_LABEL[role]} asignado` : `Rol ${ROLE_LABEL[role]} retirado`);
      refresh();
      setSelected((s) => (s ? { ...s, user_roles: on ? [...s.user_roles, { role }] : s.user_roles.filter((r) => r.role !== role) } : s));
    }
  };
  const rows = (q.data ?? []).filter((u) => roleFilter === "all" || u.user_roles.some((r) => r.role === roleFilter));

  return (
    <>
      <DataTable
        rows={rows}
        loading={q.isLoading}
        error={q.error}
        searchKeys={["email", "full_name", "company"]}
        onRowClick={setSelected}
        toolbar={
          <>
            <select className="h-10 rounded-sm border border-tone bg-white/[0.04] px-3 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filtrar por rol">
              <option value="all">Todos los roles</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setInvite({ email: "", full_name: "", role: "team" })}>
              Invitar
            </Button>
          </>
        }
        columns={[
          { key: "email", label: "Usuario", render: (u) => <span><span className="block font-medium">{u.full_name || u.email}</span><span className="text-xs text-muted">{u.email}</span></span> },
          { key: "roles", label: "Roles", render: (u) => <span className="flex flex-wrap gap-1">{u.user_roles.map((r) => <Badge key={r.role} tone={ROLE_TONE[r.role]}>{ROLE_LABEL[r.role]}</Badge>)}</span> },
          { key: "is_disabled", label: "Estado", render: (u) => (u.is_disabled ? <Badge tone="danger">Desactivado</Badge> : <Badge tone="success">Activo</Badge>) },
          { key: "created_at", label: "Alta", hideOnMobile: true, render: (u) => timeAgo(u.created_at) },
        ]}
      />
      <Modal
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        title="Invitar usuario"
        description="Recibirá un correo para crear su contraseña. Si ya tiene cuenta, se le asigna el rol."
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setInvite(null)}>Cancelar</Button><Button loading={sendInvite.isPending} onClick={() => sendInvite.mutate()} disabled={!invite?.email}>Invitar</Button></>}
      >
        {invite && (
          <div className="grid gap-3">
            <Input label="Correo" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <Input label="Nombre" value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} />
            <Select label="Rol" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} options={Object.entries(ROLE_LABEL).filter(([k]) => isAdmin || k !== "admin").map(([value, label]) => ({ value, label }))} />
          </div>
        )}
      </Modal>
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.full_name || selected?.email || "Usuario"}>
        {selected && (
          <div className="space-y-6">
            <div className="text-sm">
              <p>{selected.email}</p>
              <p className="text-muted">Alta: {formatDateTime(selected.created_at)}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Roles</p>
              {selected.id === me?.id && <Notice tone="info" className="mb-2">No puedes modificar tus propios roles.</Notice>}
              <div className="grid gap-2">
                {(["user", "customer", "team", "admin"] as const).map((r) => {
                  const has = selected.user_roles.some((x) => x.role === r);
                  const locked = selected.id === me?.id || (r === "admin" && !isAdmin);
                  return (
                    <label key={r} className="flex items-center justify-between rounded-sm border border-tone px-3 py-2 text-sm">
                      {ROLE_LABEL[r]}
                      <input type="checkbox" className="size-4 accent-[var(--nv-primary)]" checked={has} disabled={locked} onChange={(e) => void toggleRole(selected, r, e.target.checked)} />
                    </label>
                  );
                })}
              </div>
            </div>
            {selected.id !== me?.id && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={selected.is_disabled ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}
                  onClick={async () => {
                    try {
                      await api(`/admin/users/${selected.id}/disable`, { body: { disabled: !selected.is_disabled } });
                      toast("success", selected.is_disabled ? "Acceso reactivado" : "Acceso revocado");
                      setSelected({ ...selected, is_disabled: !selected.is_disabled });
                      refresh();
                    } catch (e) {
                      toast("error", "No se pudo cambiar el acceso", errorMessage(e));
                    }
                  }}
                >
                  {selected.is_disabled ? "Reactivar acceso" : "Revocar acceso"}
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    icon={<Trash2 className="size-4" />}
                    onClick={async () => {
                      if (!(await confirm("¿Eliminar la cuenta?", { danger: true, text: "Se borrarán su perfil, roles, cupones y conversaciones vinculadas. Los leads se conservan sin vínculo a la cuenta.", confirmLabel: "Eliminar" }))) return;
                      try {
                        await api(`/admin/users/${selected.id}`, { method: "DELETE" });
                        toast("success", "Cuenta eliminada");
                        setSelected(null);
                        refresh();
                      } catch (e) {
                        toast("error", "No se pudo eliminar", errorMessage(e));
                      }
                    }}
                  >
                    Eliminar cuenta
                  </Button>
                )}
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-medium">Actividad reciente</p>
              <ul className="space-y-1 text-xs">
                {(activity.data ?? []).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>
                      {a.action} · {a.entity}
                    </span>
                    <span className="text-muted">{timeAgo(a.created_at)}</span>
                  </li>
                ))}
                {activity.data?.length === 0 && <li className="text-muted">Sin actividad registrada.</li>}
              </ul>
            </div>
          </div>
        )}
      </Drawer>
      {dialog}
    </>
  );
}

function RolesMatrix({ editable }: { editable: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "role-matrix"],
    queryFn: async () => {
      const [perms, rp] = await Promise.all([supabase.from("permissions").select("key, group, description").order("group").order("key"), supabase.from("role_permissions").select("role, permission")]);
      return { perms: (perms.data ?? []) as { key: string; group: string; description: string }[], rp: (rp.data ?? []) as { role: string; permission: string }[] };
    },
  });
  if (!q.data) return <Skeleton className="h-96" />;
  const has = (role: string, p: string) => q.data.rp.some((x) => x.role === role && x.permission === p);
  const toggle = async (role: string, p: string, on: boolean) => {
    const { error } = on ? await supabase.from("role_permissions").insert({ role, permission: p }) : await supabase.from("role_permissions").delete().eq("role", role).eq("permission", p);
    if (error) toast("error", "No se pudo cambiar el permiso", errorMessage(error));
    void qc.invalidateQueries({ queryKey: ["admin", "role-matrix"] });
  };
  return (
    <Card title="Matriz de permisos" description={editable ? "El rol Administrador tiene todos los permisos. Aplica el principio de mínimo privilegio." : "Solo un administrador puede modificar esta matriz."}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">Permiso</th>
              {["user", "customer", "team", "admin"].map((r) => (
                <th key={r} className="px-3 py-2 text-center font-medium">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--tone-line)]">
            {q.data.perms.map((p) => (
              <tr key={p.key}>
                <td className="py-2 pr-4">
                  <span className="block">{p.description}</span>
                  <code className="text-[10px] text-muted">
                    {p.group} · {p.key}
                  </code>
                </td>
                {["user", "customer", "team"].map((r) => (
                  <td key={r} className="px-3 py-2 text-center">
                    <input type="checkbox" className="size-4 accent-[var(--nv-primary)]" checked={has(r, p.key)} disabled={!editable} onChange={(e) => void toggle(r, p.key, e.target.checked)} aria-label={`${ROLE_LABEL[r]}: ${p.key}`} />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <CheckCircle2 className="mx-auto size-4 text-success" aria-label="Siempre" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PrivacyRequests() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<{ id: string; email: string; type: string; status: string; details: string; resolution: string; created_at: string } | null>(null);
  const q = useQuery({ queryKey: ["admin", "privacy"], queryFn: async () => ((await supabase.from("privacy_requests").select("*").order("created_at", { ascending: false })).data ?? []) as NonNullable<typeof selected>[] });
  const resolve = async (status: "completed" | "rejected") => {
    if (!selected) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("privacy_requests").update({ status, resolution: selected.resolution, resolved_at: new Date().toISOString(), resolved_by: u.user?.id }).eq("id", selected.id);
    if (error) toast("error", "No se pudo actualizar", errorMessage(error));
    else {
      toast("success", "Solicitud actualizada");
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["admin", "privacy"] });
    }
  };
  return (
    <>
      <Notice tone="info" className="mb-4">
        Para una supresión: elimina la cuenta desde «Usuarios» y, si procede, los leads asociados en el CRM (solo administradores). Respeta los plazos legales de conservación antes de borrar datos con obligación de custodia.
      </Notice>
      <DataTable
        rows={q.data}
        loading={q.isLoading}
        onRowClick={setSelected}
        empty="No hay solicitudes."
        columns={[
          { key: "email", label: "Correo" },
          { key: "type", label: "Tipo", render: (r) => ({ access: "Acceso", deletion: "Supresión", rectification: "Rectificación" })[r.type] ?? r.type },
          { key: "status", label: "Estado", render: (r) => <Badge tone={r.status === "pending" ? "warning" : r.status === "completed" ? "success" : "neutral"}>{{ pending: "Pendiente", completed: "Resuelta", rejected: "Rechazada" }[r.status]}</Badge> },
          { key: "created_at", label: "Fecha", render: (r) => formatDateTime(r.created_at) },
        ]}
      />
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Solicitud de privacidad"
        footer={
          selected?.status === "pending" && (
            <>
              <Button variant="ghost" onClick={() => void resolve("rejected")}>
                Rechazar
              </Button>
              <Button onClick={() => void resolve("completed")}>Marcar como resuelta</Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <p>
              <strong>{selected.email}</strong> · {formatDateTime(selected.created_at)}
            </p>
            <p className="whitespace-pre-line rounded-sm border border-tone p-3">{selected.details || "Sin detalles."}</p>
            <Textarea label="Resolución" value={selected.resolution} onChange={(e) => setSelected({ ...selected, resolution: e.target.value })} disabled={selected.status !== "pending"} />
          </div>
        )}
      </Drawer>
    </>
  );
}
