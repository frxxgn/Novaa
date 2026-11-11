import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Download, FileText, FolderKanban, Gauge, LogOut, MailWarning, MessagesSquare, Receipt, Ticket, UserRound } from "lucide-react";
import { useAuth } from "@/app/auth";
import { useI18n } from "@/i18n";
import { useSeo } from "@/hooks/useSeo";
import { api, downloadApi, errorMessage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, Notice, Skeleton, useToast } from "@/components/ui/feedback";
import { QuoteCard } from "@/features/nova/QuoteCard";
import { forgetQuoteToken, quoteTokens, rowToQuote } from "@/features/nova/useNova";
import { openNova } from "@/features/nova/NovaWidget";

const PROJECT_STATUS: Record<string, { label: string; tone: "violet" | "info" | "success" | "warning" | "neutral" | "danger" }> = {
  planning: { label: "Planificación", tone: "info" },
  in_progress: { label: "En desarrollo", tone: "violet" },
  review: { label: "En revisión", tone: "warning" },
  completed: { label: "Completado", tone: "success" },
  paused: { label: "En pausa", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "danger" },
};

const QUOTE_STATUS: Record<string, string> = { estimate: "Estimación", saved: "Guardado", proposal_requested: "Propuesta solicitada", sent: "Propuesta enviada", accepted: "Aceptado", rejected: "Rechazado", expired: "Caducado" };

export function AccountLayout() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const links = [
    ["/cuenta", t("account.dashboard"), Gauge],
    ["/cuenta/proyectos", t("account.projects"), FolderKanban],
    ["/cuenta/presupuestos", t("account.quotes"), Receipt],
    ["/cuenta/cupones", t("account.coupons"), Ticket],
    ["/cuenta/conversaciones", t("account.conversations"), MessagesSquare],
    ["/cuenta/perfil", t("account.profile"), UserRound],
  ] as const;
  useSeo({ title: "Mi cuenta", noindex: true });

  return (
    <section className="tone-dark min-h-[100svh] pb-24 pt-28">
      <div className="container-nv grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="truncate text-sm text-muted">{user?.email}</p>
          <nav className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:flex-col lg:px-0" aria-label="Cuenta">
            {links.map(([to, label, I]) => (
              <NavLink key={to} to={to} end={to === "/cuenta"} className={({ isActive }) => cn("flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors", isActive ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
                <I className="size-4" /> {label}
              </NavLink>
            ))}
            <button onClick={() => void signOut()} className="flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white">
              <LogOut className="size-4" /> {t("nav.logout")}
            </button>
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </section>
  );
}

function useClaimStoredQuotes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const tokens = quoteTokens();
    const ids = Object.keys(tokens);
    if (!ids.length) return;
    void Promise.allSettled(ids.map((id) => api(`/quotes/${id}/claim`, { body: { token: tokens[id] } }).then(() => forgetQuoteToken(id)))).then(() => qc.invalidateQueries({ queryKey: ["my-quotes"] }));
  }, [user, qc]);
}

export function AccountDashboard() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  useClaimStoredQuotes();
  const data = useQuery({
    queryKey: ["account-summary", user?.id],
    queryFn: async () => {
      const [profile, quotes, projects, coupons, notifications] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
        supabase.from("quotes").select("id", { count: "exact", head: true }),
        supabase.from("customer_projects").select("id, name, status, progress, due_date").order("updated_at", { ascending: false }).limit(3),
        supabase.from("coupons").select("code, percent, status, expires_at").limit(1),
        supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(6),
      ]);
      return { name: profile.data?.full_name ?? "", quotes: quotes.count ?? 0, projects: projects.data ?? [], coupon: coupons.data?.[0] ?? null, notifications: notifications.data ?? [] };
    },
    enabled: Boolean(user),
  });
  const verified = Boolean(user?.email_confirmed_at);
  const toast = useToast();

  return (
    <div className="space-y-8">
      {params.get("verificado") && <Notice tone="success">Correo verificado. ¡Bienvenido a Novalius!</Notice>}
      {params.get("password") && <Notice tone="success">Contraseña actualizada.</Notice>}
      <div>
        <p className="eyebrow text-lavender">Mi cuenta</p>
        <h1 className="display-md mt-3">Hola{data.data?.name ? `, ${data.data.name.split(" ")[0]}` : ""}.</h1>
      </div>
      {!verified && (
        <Notice tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <MailWarning className="size-4" /> Verifica tu correo para jugar en Novalius Challenge.
            </span>
            <button
              className="text-sm underline underline-offset-4"
              onClick={async () => {
                const { error } = await supabase.auth.resend({ type: "signup", email: user!.email!, options: { emailRedirectTo: `${window.location.origin}/auth/confirmar` } });
                if (error) toast("error", "No se pudo reenviar", errorMessage(error));
                else toast("success", "Correo reenviado");
              }}
            >
              Reenviar enlace
            </button>
          </div>
        </Notice>
      )}
      {data.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Link to="/cuenta/presupuestos" className="glass rounded-md p-5 hover:bg-white/[0.08]">
            <Receipt className="size-5 text-lavender" />
            <p className="mt-4 font-display text-3xl">{data.data?.quotes ?? 0}</p>
            <p className="text-sm text-muted">Presupuestos</p>
          </Link>
          <Link to="/cuenta/proyectos" className="glass rounded-md p-5 hover:bg-white/[0.08]">
            <FolderKanban className="size-5 text-lavender" />
            <p className="mt-4 font-display text-3xl">{data.data?.projects.length ?? 0}</p>
            <p className="text-sm text-muted">Proyectos</p>
          </Link>
          <Link to="/cuenta/cupones" className="glass rounded-md p-5 hover:bg-white/[0.08]">
            <Ticket className="size-5 text-lavender" />
            <p className="mt-4 font-display text-3xl">{data.data?.coupon ? `−${data.data.coupon.percent} %` : "—"}</p>
            <p className="text-sm text-muted">{data.data?.coupon ? data.data.coupon.code : "Gana uno en el Challenge"}</p>
          </Link>
        </div>
      )}
      {(data.data?.projects.length ?? 0) > 0 && (
        <div>
          <h2 className="font-display text-xl">Tus proyectos</h2>
          <ul className="mt-4 space-y-3">
            {data.data!.projects.map((p) => (
              <li key={p.id}>
                <Link to={`/cuenta/proyectos/${p.id}`} className="glass flex items-center justify-between gap-4 rounded-md p-4 hover:bg-white/[0.08]">
                  <span className="font-medium">{p.name}</span>
                  <span className="flex items-center gap-3">
                    <Badge tone={PROJECT_STATUS[p.status]?.tone ?? "neutral"}>{PROJECT_STATUS[p.status]?.label ?? p.status}</Badge>
                    <span className="font-mono text-xs text-muted">{p.progress} %</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Bell className="size-5" /> {"Notificaciones"}
        </h2>
        {data.data?.notifications.length ? (
          <ul className="mt-4 divide-y divide-white/10 rounded-md border border-tone">
            {data.data.notifications.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No tienes notificaciones.</p>
        )}
      </div>
      <div className="glass flex flex-col items-start gap-4 rounded-md p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg">¿Un nuevo proyecto en mente?</p>
          <p className="text-sm text-muted">Nova te prepara una estimación en minutos.</p>
        </div>
        <Button onClick={() => openNova()}>Hablar con Nova</Button>
      </div>
    </div>
  );
}

export function AccountProjects() {
  const q = useQuery({ queryKey: ["my-projects"], queryFn: async () => (await supabase.from("customer_projects").select("id, name, description, status, progress, start_date, due_date").order("created_at", { ascending: false })).data ?? [] });
  return (
    <div>
      <h1 className="display-md">Proyectos</h1>
      <div className="mt-8">
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : !q.data?.length ? (
          <EmptyState icon={<FolderKanban className="size-8" />} title="Aún no tienes proyectos" text="Cuando el equipo de Novalius inicie un proyecto contigo, aparecerá aquí con sus fases, tareas y archivos." action={<ButtonLink to="/contacto?intent=propuesta">Solicitar una propuesta</ButtonLink>} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {q.data.map((p) => (
              <li key={p.id}>
                <Link to={`/cuenta/proyectos/${p.id}`} className="glass block rounded-md p-6 hover:bg-white/[0.08]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-xl">{p.name}</p>
                    <Badge tone={PROJECT_STATUS[p.status]?.tone ?? "neutral"}>{PROJECT_STATUS[p.status]?.label}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${p.progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {p.progress} % · Entrega prevista: {formatDate(p.due_date)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AccountProjectDetail() {
  const { id = "" } = useParams();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["my-project", id],
    queryFn: async () => {
      const [project, phases, tasks, files, updates] = await Promise.all([
        supabase.from("customer_projects").select("*").eq("id", id).maybeSingle(),
        supabase.from("project_phases").select("*").eq("project_id", id).order("position"),
        supabase.from("project_tasks").select("id, title, description, status, due_date, phase_id").eq("project_id", id).order("position"),
        supabase.from("project_files").select("id, file_name, storage_path, size_bytes, created_at").eq("project_id", id).order("created_at", { ascending: false }),
        supabase.from("project_updates").select("id, body, created_at").eq("project_id", id).order("created_at", { ascending: false }),
      ]);
      return { project: project.data, phases: phases.data ?? [], tasks: tasks.data ?? [], files: files.data ?? [], updates: updates.data ?? [] };
    },
  });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error) return <ErrorState error={q.error} />;
  const d = q.data!;
  if (!d.project) return <EmptyState title="Proyecto no encontrado" />;
  const p = d.project;

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 60, { download: name });
    if (error || !data) toast("error", "No se pudo descargar", errorMessage(error));
    else window.location.href = data.signedUrl;
  };

  return (
    <div className="space-y-10">
      <div>
        <Link to="/cuenta/proyectos" className="text-sm text-muted hover:text-white">
          ← Proyectos
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="display-md">{p.name}</h1>
          <Badge tone={PROJECT_STATUS[p.status]?.tone ?? "neutral"}>{PROJECT_STATUS[p.status]?.label}</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-muted">{p.description}</p>
        <div className="mt-6 max-w-xl">
          <div className="flex justify-between text-sm">
            <span>Progreso</span>
            <span className="font-mono">{p.progress} %</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${p.progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Inicio: {formatDate(p.start_date)} · Entrega prevista: {formatDate(p.due_date)}
          </p>
        </div>
      </div>
      {d.phases.length > 0 && (
        <div>
          <h2 className="font-display text-xl">Fases</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {d.phases.map((ph, i) => (
              <li key={ph.id} className={cn("rounded-md border p-4", ph.status === "done" ? "border-success/40 bg-success/10" : ph.status === "active" ? "border-lavender bg-white/[0.06]" : "border-tone")}>
                <p className="font-mono text-xs text-muted">Fase {i + 1}</p>
                <p className="mt-1 font-medium">{ph.name}</p>
                <p className="mt-1 text-xs text-muted">{ph.status === "done" ? "Completada" : ph.status === "active" ? "En curso" : "Pendiente"}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-xl">Tareas</h2>
          {d.tasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Sin tareas visibles.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {d.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-sm border border-tone p-3 text-sm">
                  <span className={cn(t.status === "done" && "text-muted line-through")}>{t.title}</span>
                  <Badge tone={t.status === "done" ? "success" : t.status === "in_progress" ? "violet" : t.status === "blocked" ? "danger" : "neutral"}>{{ todo: "Pendiente", in_progress: "En curso", blocked: "Bloqueada", done: "Hecha" }[t.status as string]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-display text-xl">Archivos</h2>
          {d.files.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No hay archivos compartidos.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {d.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-sm border border-tone p-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-lavender" />
                    <span className="truncate">{f.file_name}</span>
                  </span>
                  <button className="inline-flex items-center gap-1 text-lavender" onClick={() => download(f.storage_path, f.file_name)}>
                    <Download className="size-4" /> Descargar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {d.updates.length > 0 && (
        <div>
          <h2 className="font-display text-xl">Novedades</h2>
          <ul className="mt-4 space-y-3">
            {d.updates.map((u) => (
              <li key={u.id} className="rounded-md border border-tone p-4">
                <p className="text-xs text-muted">{formatDateTime(u.created_at)}</p>
                <p className="mt-1 whitespace-pre-line">{u.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AccountQuotes() {
  useClaimStoredQuotes();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-quotes"], queryFn: async () => (await supabase.from("quotes").select("*, quote_items(*)").order("created_at", { ascending: false })).data ?? [] });
  const request = useMutation({
    mutationFn: (id: string) => api(`/quotes/${id}/request-proposal`, { body: { consent: true } }),
    onSuccess: () => {
      toast("success", "Propuesta solicitada", "El equipo de Novalius te escribirá en breve.");
      void qc.invalidateQueries({ queryKey: ["my-quotes"] });
    },
    onError: (e) => toast("error", "No se pudo solicitar", errorMessage(e)),
  });
  return (
    <div>
      <h1 className="display-md">Presupuestos</h1>
      <p className="mt-2 text-muted">Estimaciones orientativas calculadas con las tarifas de Novalius.</p>
      <div className="mt-8 space-y-6">
        {q.isLoading ? (
          <Skeleton className="h-60" />
        ) : !q.data?.length ? (
          <EmptyState icon={<Receipt className="size-8" />} title="Todavía no tienes presupuestos" text="Pide a Nova una estimación y guárdala en tu cuenta." action={<Button onClick={() => openNova("Quiero un presupuesto para mi proyecto")}>Hablar con Nova</Button>} />
        ) : (
          q.data.map((row) => (
            <div key={row.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {formatDate(row.created_at)} · <Badge tone={row.status === "proposal_requested" ? "violet" : "neutral"}>{QUOTE_STATUS[row.status] ?? row.status}</Badge>
                </p>
                {!row.lead_id && (
                  <Button size="sm" onClick={() => request.mutate(row.id)} loading={request.isPending && request.variables === row.id}>
                    Solicitar propuesta personalizada
                  </Button>
                )}
              </div>
              <QuoteCard quote={rowToQuote(row)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AccountCoupons() {
  const q = useQuery({ queryKey: ["my-coupons"], queryFn: async () => (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ?? [] });
  return (
    <div>
      <h1 className="display-md">Cupones</h1>
      <div className="mt-8">
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : !q.data?.length ? (
          <EmptyState icon={<Ticket className="size-8" />} title="Aún no tienes cupones" text="Supera Novalius Challenge para desbloquear un descuento en tu proyecto." action={<ButtonLink to="/challenge">Ir al Challenge</ButtonLink>} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {q.data.map((c) => {
              const expired = c.status === "available" && new Date(c.expires_at) < new Date();
              const status = expired ? "expired" : c.status;
              return (
                <li key={c.id} className="rounded-md bg-white p-6 text-ink">
                  <div className="flex items-start justify-between">
                    <p className="font-display text-4xl tracking-tighter">−{Number(c.percent)} %</p>
                    <Badge tone={status === "available" ? "success" : status === "used" ? "info" : "danger"} className="!text-ink">
                      {{ available: "Disponible", used: "Utilizado", expired: "Caducado", revoked: "Revocado" }[status as string]}
                    </Badge>
                  </div>
                  <code className="mt-4 block rounded-sm border-2 border-dashed border-primary/40 px-3 py-2 font-mono tracking-widest">{c.code}</code>
                  <p className="mt-3 text-xs text-ink/60">Caduca el {formatDate(c.expires_at)}. {c.conditions}</p>
                  {status === "available" && <p className="mt-2 text-xs text-ink/70">Indícalo al solicitar tu propuesta: el equipo lo validará y aplicará.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AccountConversations() {
  const q = useQuery({ queryKey: ["my-conversations"], queryFn: () => api<{ conversations: { id: string; title: string; last_message_at: string; message_count: number; status: string }[] }>("/nova/conversations") });
  return (
    <div>
      <h1 className="display-md">Conversaciones con Nova</h1>
      <div className="mt-8">
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : !q.data?.conversations.length ? (
          <EmptyState icon={<MessagesSquare className="size-8" />} title="Sin conversaciones guardadas" text="Las conversaciones que mantengas con Nova mientras tienes la sesión iniciada aparecerán aquí." action={<Button onClick={() => openNova()}>Hablar con Nova</Button>} />
        ) : (
          <ul className="divide-y divide-white/10 rounded-md border border-tone">
            {q.data.conversations.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.title || "Conversación"}</p>
                  <p className="text-xs text-muted">
                    {timeAgo(c.last_message_at)} · {c.message_count} mensajes
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    localStorage.setItem("nv-nova-conv", JSON.stringify({ id: c.id, token: "" }));
                    window.location.reload();
                  }}
                >
                  Continuar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AccountProfile() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["me", "profile"], queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data, enabled: Boolean(user) });
  const [form, setForm] = useState({ full_name: "", company: "", phone: "", locale: "es", marketing_opt_in: false });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [privacy, setPrivacy] = useState({ type: "deletion", details: "" });

  useEffect(() => {
    if (profile.data) setForm({ full_name: profile.data.full_name, company: profile.data.company, phone: profile.data.phone, locale: profile.data.locale, marketing_opt_in: profile.data.marketing_opt_in });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("success", "Perfil actualizado");
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast("error", "No se pudo guardar", errorMessage(e)),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (pw.next.length < 10 || !/[a-z]/i.test(pw.next) || !/\d/.test(pw.next)) throw new Error("La nueva contraseña debe tener al menos 10 caracteres, con letras y números.");
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: pw.current });
      if (authErr) throw new Error("La contraseña actual no es correcta.");
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
    },
    onSuccess: () => {
      setPw({ current: "", next: "" });
      toast("success", "Contraseña actualizada");
    },
    onError: (e) => toast("error", "No se pudo cambiar", errorMessage(e)),
  });

  const requestPrivacy = useMutation({
    mutationFn: () => api("/account/privacy-request", { body: privacy }),
    onSuccess: () => toast("success", "Solicitud registrada", "El equipo la tramitará y te responderá por correo."),
    onError: (e) => toast("error", "No se pudo enviar", errorMessage(e)),
  });

  return (
    <div className="space-y-12">
      <h1 className="display-md">Perfil</h1>
      <form
        className="glass grid gap-4 rounded-md p-6 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Input label="Nombre" value={form.full_name} maxLength={120} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input label="Empresa" value={form.company} maxLength={160} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <Input label="Teléfono" value={form.phone} maxLength={40} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Select label="Idioma" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} options={[{ value: "es", label: "Español" }, { value: "en", label: "English" }]} />
        <div className="md:col-span-2">
          <Checkbox checked={form.marketing_opt_in} onChange={(v) => setForm({ ...form, marketing_opt_in: v })} label="Quiero recibir novedades de Novalius por correo." />
        </div>
        <Button type="submit" loading={save.isPending} className="md:justify-self-start">
          Guardar cambios
        </Button>
      </form>

      <form
        className="glass grid gap-4 rounded-md p-6 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          changePassword.mutate();
        }}
      >
        <h2 className="font-display text-xl md:col-span-2">Cambiar contraseña</h2>
        <Input label="Contraseña actual" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <Input label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={10} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <Button type="submit" variant="outline" loading={changePassword.isPending} className="md:justify-self-start">
          Actualizar contraseña
        </Button>
      </form>

      <div className="glass space-y-5 rounded-md p-6">
        <h2 className="font-display text-xl">Privacidad y tus datos</h2>
        <p className="text-sm text-muted">Descarga una copia de tus datos o solicita su rectificación o supresión.</p>
        <Button variant="outline" icon={<Download className="size-4" />} onClick={() => downloadApi("/account/export", "novalius-mis-datos.json").catch((e) => toast("error", "No se pudo exportar", errorMessage(e)))}>
          Descargar mis datos (JSON)
        </Button>
        <form
          className="grid gap-4 border-t border-tone pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            requestPrivacy.mutate();
          }}
        >
          <Select label="Tipo de solicitud" value={privacy.type} onChange={(e) => setPrivacy({ ...privacy, type: e.target.value })} options={[{ value: "deletion", label: "Supresión de mi cuenta y datos" }, { value: "rectification", label: "Rectificación de datos" }]} />
          <Textarea label="Detalles" maxLength={2000} rows={3} value={privacy.details} onChange={(e) => setPrivacy({ ...privacy, details: e.target.value })} />
          <Button type="submit" variant="outline" loading={requestPrivacy.isPending} className="justify-self-start">
            Enviar solicitud
          </Button>
        </form>
      </div>
    </div>
  );
}
