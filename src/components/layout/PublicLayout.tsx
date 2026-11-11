import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Wrench } from "lucide-react";
import { useSite } from "@/app/site";
import { useAuth } from "@/app/auth";
import { usePrefs } from "@/app/prefs";
import { track } from "@/lib/analytics";
import { Cursor } from "@/components/motion/Cursor";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { NovaliusMark } from "@/components/brand/Logo";
import { NovaWidget, openNova } from "@/features/nova/NovaWidget";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Intro } from "./Intro";

function Maintenance({ message }: { message: string }) {
  return (
    <main className="tone-dark flex min-h-[100svh] flex-col items-center justify-center gap-6 p-6 text-center">
      <NovaliusMark className="size-20 animate-float" />
      <h1 className="font-display text-3xl">Volvemos enseguida</h1>
      <p className="max-w-md text-muted">{message}</p>
      <Wrench className="size-5 text-lavender" />
    </main>
  );
}

export function PublicLayout() {
  const { settings, animations } = useSite();
  const { isStaff } = useAuth();
  const { motionEnabled } = usePrefs();
  const { pathname } = useLocation();

  // Página vista (solo si hay consentimiento: lo decide track())
  useEffect(() => {
    track("page_view");
  }, [pathname]);

  // Cualquier enlace a #nova abre el asistente
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href='#nova']");
      if (a) {
        e.preventDefault();
        openNova();
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (settings.site_status?.maintenance && !isStaff) return <Maintenance message={settings.site_status.message} />;

  const transitions = motionEnabled && animations.page_transitions;

  return (
    <>
      <Intro />
      <SmoothScroll />
      <Cursor />
      {settings.site_status?.maintenance && isStaff && <div className="fixed inset-x-0 top-0 z-[700] bg-warning py-1 text-center text-xs font-medium text-ink">Modo mantenimiento activo: solo el equipo ve la web.</div>}
      <Header />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          id="contenido"
          key={pathname}
          initial={transitions ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={transitions ? { opacity: 0, y: -8 } : undefined}
          transition={{ duration: 0.35 / animations.speed, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-[100svh]"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <Footer />
      <NovaWidget />
      <CookieBanner />
    </>
  );
}
