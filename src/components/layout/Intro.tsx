import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";
import { useI18n } from "@/i18n";
import { safeStorage } from "@/lib/utils";
import { NovaliusMark } from "@/components/brand/Logo";

/**
 * Presentación inicial: aparición del isotipo, barrido de luz y revelado del
 * logotipo. Solo una vez por sesión, con botón para saltar y desactivable.
 * Nunca bloquea la carga: el contenido se monta debajo desde el primer instante.
 */
export function Intro() {
  const { animations, loading } = useSite();
  const { motionEnabled } = usePrefs();
  const { t } = useI18n();
  const [show, setShow] = useState(() => safeStorage.get("nv-intro", true) !== "1" && window.location.pathname === "/");

  const enabled = animations.enabled && animations.intro && motionEnabled;

  useEffect(() => {
    if (loading) return;
    if (!enabled) {
      setShow(false);
      return;
    }
    if (!show) return;
    safeStorage.set("nv-intro", "1", true);
    const timer = setTimeout(() => setShow(false), animations.intro_duration * 1000 + 400);
    return () => clearTimeout(timer);
  }, [enabled, show, loading, animations.intro_duration]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShow(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show]);

  const d = animations.intro_duration;

  return (
    <AnimatePresence>
      {show && enabled && (
        <motion.div
          className="fixed inset-0 z-[600] flex items-center justify-center overflow-hidden bg-[var(--nv-bg-dark)]"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden
        >
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: d * 0.6 }} style={{ background: "radial-gradient(50% 40% at 50% 50%, color-mix(in oklab, var(--nv-primary) 40%, transparent), transparent 70%)" }} />
          <motion.div
            className="absolute inset-y-0 w-1/3 -skew-x-12"
            initial={{ x: "-120vw" }}
            animate={{ x: "160vw" }}
            transition={{ duration: d * 0.7, delay: d * 0.2, ease: [0.65, 0, 0.35, 1] }}
            style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--nv-lavender) 22%, transparent), transparent)" }}
          />
          <div className="relative flex flex-col items-center gap-6">
            <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ duration: d * 0.45, ease: [0.16, 1, 0.3, 1] }}>
              <NovaliusMark className="size-24 md:size-28" />
            </motion.div>
            <div className="overflow-hidden">
              <motion.p initial={{ y: "110%" }} animate={{ y: "0%" }} transition={{ duration: d * 0.35, delay: d * 0.32, ease: [0.16, 1, 0.3, 1] }} className="font-display text-4xl font-bold tracking-[-0.05em] text-white md:text-5xl">
                nova<span className="text-gradient">lius</span>
              </motion.p>
            </div>
            <motion.div className="h-px w-48 origin-left bg-gradient-to-r from-transparent via-lavender to-transparent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: d * 0.4, delay: d * 0.45 }} />
          </div>
          <button
            onClick={() => setShow(false)}
            className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] right-6 rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white"
            aria-hidden={false}
          >
            {t("intro.skip")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
