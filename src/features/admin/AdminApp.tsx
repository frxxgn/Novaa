import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Calculator,
  ExternalLink,
  FileStack,
  FolderKanban,
  Gamepad2,
  Gauge,
  Image,
  Languages,
  LayoutTemplate,
  ListTree,
  LogOut,
  Menu,
  MessagesSquare,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { cn, timeAgo } from "@/lib/utils";
import { Skeleton } from "@/components/ui/feedback";
import { NovaliusMark } from "@/components/brand/Logo";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const PagesList = lazy(() => import("./pages/PagesList"));
const PageEditor = lazy(() => import("./pages/PageEditor"));
const DesignEditor = lazy(() => import("./pages/DesignEditor"));
const ContentPages = lazy(() => import("./pages/ContentPages"));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary"));
const NovaAdmin = lazy(() => import("./pages/NovaAdmin"));
const ConversationView = lazy(() => import("./pages/NovaAdmin").then((m) => ({ default: m.ConversationView })));
const PricingAdmin = lazy(() => import("./pages/PricingAdmin"));
const CrmAdmin = lazy(() => import("./pages/CrmAdmin"));
const LeadDetail = lazy(() => import("./pages/CrmAdmin").then((m) => ({ default: m.LeadDetail })));
const CustomersAdmin = lazy(() => import("./pages/CustomersAdmin"));
const ProjectsAdmin = lazy(() => import("./pages/ProjectsAdmin"));
const ProjectEditor = lazy(() => import("./pages/ProjectsAdmin").then((m) => ({ default: m.ProjectEditor })));
const ChallengeAdmin = lazy(() => import("./pages/ChallengeAdmin"));
const UsersAdmin = lazy(() => import("./pages/UsersAdmin"));
const NotificationsAdmin = lazy(() => import("./pages/NotificationsAdmin"));
const AnalyticsAdmin = lazy(() => import("./pages/AnalyticsAdmin"));
const SettingsAdmin = lazy(() => import("./pages/SettingsAdmin"));
const AuditAdmin = lazy(() => import("./pages/AuditAdmin"));

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  keywords?: string;
}

const NAV: { group: string; items: NavEntry[] }[] = [
  { group: "General", items: [{ to: "/admin", label: "Dashboard", icon: Gauge, permission: "dashboard.view", keywords: "inicio resumen métricas" }] },
  {
    group: "Web",
    items: [
      { to: "/admin/paginas", label: "Páginas", icon: FileStack, permission: "content.manage", keywords: "editor visual secciones cms publicar" },
      { to: "/admin/diseno", label: "Diseño global", icon: Palette, permission: "design.manage", keywords: "colores tipografía tokens" },
      { to: "/admin/animaciones", label: "Animaciones", icon: Wand2, permission: "design.manage", keywords: "movimiento 3d cursor intro" },
      { to: "/admin/contenido/servicios", label: "Servicios", icon: Sparkles, permission: "content.manage" },
      { to: "/admin/contenido/proyectos", label: "Portfolio", icon: BriefcaseBusiness, permission: "content.manage", keywords: "proyectos casos" },
      { to: "/admin/contenido/plantillas", label: "Plantillas", icon: LayoutTemplate, permission: "content.manage", keywords: "demos sectores" },
      { to: "/admin/contenido/faq", label: "Preguntas frecuentes", icon: MessagesSquare, permission: "content.manage", keywords: "faq" },
      { to: "/admin/contenido/navegacion", label: "Navegación y pie", icon: ListTree, permission: "content.manage", keywords: "menú footer enlaces" },
      { to: "/admin/contenido/medios", label: "Medios", icon: Image, permission: "content.manage", keywords: "imágenes vídeos archivos" },
      { to: "/admin/contenido/traducciones", label: "Traducciones", icon: Languages, permission: "content.manage", keywords: "idiomas inglés i18n" },
    ],
  },
  {
    group: "Comercial",
    items: [
      { to: "/admin/crm", label: "CRM · Leads", icon: Users, permission: "crm.read", keywords: "oportunidades contactos" },
      { to: "/admin/clientes", label: "Clientes", icon: UserRound, permission: "customers.manage" },
      { to: "/admin/proyectos", label: "Proyectos de clientes", icon: FolderKanban, permission: "projects.manage", keywords: "tareas fases archivos" },
      { to: "/admin/nova", label: "Nova", icon: Bot, permission: "nova.conversations.read", keywords: "asistente ia conversaciones conocimiento" },
      { to: "/admin/tarifas", label: "Tarifas", icon: Calculator, permission: "pricing.manage", keywords: "presupuestos precios" },
      { to: "/admin/challenge", label: "Challenge y cupones", icon: Gamepad2, permission: "coupons.manage", keywords: "juegos quiz preguntas descuentos" },
    ],
  },
  {
    group: "Sistema",
    items: [
      { to: "/admin/analiticas", label: "Analíticas", icon: BarChart3, permission: "analytics.read", keywords: "visitas conversiones" },
      { to: "/admin/notificaciones", label: "Notificaciones", icon: Bell, permission: "notifications.manage", keywords: "correo whatsapp avisos" },
      { to: "/admin/usuarios", label: "Usuarios y permisos", icon: ShieldCheck, permission: "users.manage", keywords: "roles equipo invitar privacidad" },
      { to: "/admin/configuracion", label: "Configuración", icon: Settings, permission: "settings.manage", keywords: "empresa contacto seo marca logotipo mantenimiento" },
      { to: "/admin/auditoria", label: "Auditoría", icon: FileStack, permission: "audit.read", keywords: "registro cambios seguridad" },
    ],
  },
];

function Fallback() {
  return (
    <div className="p-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-6 h-80" />
    </div>
  );
}

export default function AdminApp() {
  const { user, can, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isEditor = /^\/admin\/paginas\/[^/]+$/.test(pathname);

  useEffect(() => {
    document.documentElement.classList.remove("nv-cursor");
    setMobileOpen(false);
  }, [pathname]);

  // Registro de acceso al panel (auditoría)
  useEffect(() => {
    void supabase.rpc("log_action", { p_action: "admin.access", p_entity: "admin", p_entity_id: "panel", p_context: {} });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = useMemo(() => NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter((g) => g.items.length), [can]);

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Panel">
      <div className="flex h-16 items-center gap-2.5 border-b border-tone px-5">
        <NovaliusMark className="size-8" />
        <span className="font-display text-lg font-bold tracking-tight">
          nova<span className="text-gradient">lius</span>
        </span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">Panel</span>
      </div>
      <button onClick={() => setPaletteOpen(true)} className="mx-3 mt-4 flex items-center gap-2 rounded-sm border border-tone px-3 py-2 text-sm text-muted hover:text-[var(--tone-fg)]">
        <Search className="size-4" /> Buscar sección
        <kbd className="ml-auto rounded bg-white/10 px-1.5 text-[10px]">Ctrl K</kbd>
      </button>
      <div className="mt-3 flex-1 overflow-y-auto px-3 pb-6">
        {nav.map((g) => (
          <div key={g.group} className="mt-4">
            <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{g.group}</p>
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === "/admin"} className={({ isActive }) => cn("flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors", isActive ? "bg-white/10 text-[var(--tone-fg)]" : "text-muted hover:bg-white/5 hover:text-[var(--tone-fg)]")}>
                <i.icon className="size-4" /> {i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-tone p-3">
        <Link to="/" target="_blank" className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-muted hover:bg-white/5 hover:text-[var(--tone-fg)]">
          <ExternalLink className="size-4" /> Ver la web
        </Link>
        <button onClick={() => void signOut().then(() => navigate("/"))} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-muted hover:bg-white/5 hover:text-[var(--tone-fg)]">
          <LogOut className="size-4" /> Cerrar sesión
        </button>
        <p className="mt-2 truncate px-2.5 text-xs text-muted">{user?.email}</p>
      </div>
    </nav>
  );

  return (
    <div className="tone-dark min-h-[100dvh]" style={{ background: "var(--nv-bg-dark)" }}>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-tone", !isEditor && "lg:block")} style={{ background: "color-mix(in oklab, var(--nv-surface-dark) 80%, var(--nv-bg-dark))" }}>
        {sidebar}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-tone" style={{ background: "var(--nv-surface-dark)" }}>
            {sidebar}
          </aside>
        </div>
      )}
      <div className={cn(!isEditor && "lg:pl-64")}>
        {!isEditor && (
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-tone px-4 backdrop-blur-xl md:px-8" style={{ background: "color-mix(in oklab, var(--nv-bg-dark) 85%, transparent)" }}>
            <button className="rounded-sm p-2 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
              <Menu className="size-5" />
            </button>
            <p className="truncate text-sm text-muted">{NAV.flatMap((g) => g.items).find((i) => (i.to === "/admin" ? pathname === "/admin" : pathname.startsWith(i.to)))?.label ?? "Panel"}</p>
            <div className="ml-auto flex items-center gap-1">
              <NotificationsBell />
            </div>
          </header>
        )}
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="paginas" element={<PagesList />} />
            <Route path="paginas/:id" element={<PageEditor />} />
            <Route path="diseno" element={<DesignEditor tab="design" />} />
            <Route path="animaciones" element={<DesignEditor tab="animations" />} />
            <Route path="contenido/medios" element={<MediaLibrary />} />
            <Route path="contenido/:kind" element={<ContentPages />} />
            <Route path="nova" element={<NovaAdmin />} />
            <Route path="nova/conversaciones/:id" element={<ConversationView />} />
            <Route path="tarifas" element={<PricingAdmin />} />
            <Route path="crm" element={<CrmAdmin />} />
            <Route path="crm/:id" element={<LeadDetail />} />
            <Route path="clientes" element={<CustomersAdmin />} />
            <Route path="proyectos" element={<ProjectsAdmin />} />
            <Route path="proyectos/:id" element={<ProjectEditor />} />
            <Route path="challenge" element={<ChallengeAdmin />} />
            <Route path="usuarios" element={<UsersAdmin />} />
            <Route path="notificaciones" element={<NotificationsAdmin />} />
            <Route path="analiticas" element={<AnalyticsAdmin />} />
            <Route path="configuracion" element={<SettingsAdmin />} />
            <Route path="auditoria" element={<AuditAdmin />} />
            <Route path="*" element={<div className="p-10 text-muted">Sección no encontrada.</div>} />
          </Routes>
        </Suspense>
      </div>
      {paletteOpen && <CommandPalette items={nav.flatMap((g) => g.items)} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

function CommandPalette({ items, onClose }: { items: NavEntry[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const results = items.filter((i) => `${i.label} ${i.keywords ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const go = (to: string) => {
    navigate(to);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Buscar sección">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-md border border-tone shadow-2xl" style={{ background: "var(--nv-surface-dark)" }}>
        <div className="flex items-center gap-2 border-b border-tone px-4">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            className="h-12 flex-1 bg-transparent text-sm focus:outline-none"
            placeholder="Ir a…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setIndex((i) => Math.min(results.length - 1, i + 1));
              if (e.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
              if (e.key === "Enter" && results[index]) go(results[index].to);
              if (e.key === "Escape") onClose();
            }}
            aria-label="Buscar sección del panel"
          />
          <button onClick={onClose} aria-label="Cerrar">
            <X className="size-4 text-muted" />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.map((r, i) => (
            <li key={r.to}>
              <button onClick={() => go(r.to)} className={cn("flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm", i === index ? "bg-white/10" : "hover:bg-white/5")}>
                <r.icon className="size-4 text-muted" /> {r.label}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Sin resultados</li>}
        </ul>
      </div>
    </div>
  );
}

function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "my-notifications", user?.id],
    queryFn: async () => (await supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(20)).data ?? [],
    refetchInterval: 30_000,
    enabled: Boolean(user),
  });
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-full p-2 hover:bg-white/10" aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ""}`} aria-expanded={open}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-md border border-tone shadow-2xl" style={{ background: "var(--nv-surface-dark)" }}>
          <div className="flex items-center justify-between border-b border-tone px-4 py-3">
            <p className="text-sm font-medium">Notificaciones</p>
            {unread > 0 && (
              <button
                className="text-xs text-lavender"
                onClick={async () => {
                  await supabase.rpc("mark_notifications_read", { p_ids: null });
                  void qc.invalidateQueries({ queryKey: ["admin", "my-notifications"] });
                }}
              >
                Marcar todo como leído
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-[var(--tone-line)] overflow-y-auto">
            {(q.data ?? []).length === 0 && <li className="p-6 text-center text-sm text-muted">Sin notificaciones.</li>}
            {(q.data ?? []).map((n) => (
              <li key={n.id}>
                <Link
                  to={n.link || "#"}
                  onClick={async () => {
                    setOpen(false);
                    if (!n.read_at) {
                      await supabase.rpc("mark_notifications_read", { p_ids: [n.id] });
                      void qc.invalidateQueries({ queryKey: ["admin", "my-notifications"] });
                    }
                  }}
                  className="block px-4 py-3 hover:bg-white/5"
                >
                  <p className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted">{timeAgo(n.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
