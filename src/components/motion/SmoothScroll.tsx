import { useEffect } from "react";
import { useLocation } from "react-router";
import Lenis from "lenis";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";

let lenis: Lenis | null = null;

export function scrollToTarget(target: string | HTMLElement | number, offset = -80) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.2 });
  else if (typeof target === "number") window.scrollTo({ top: target });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ block: "start" });
  }
}

/** Scroll suave (Lenis) solo si está activado y el usuario no pide menos movimiento. */
export function SmoothScroll() {
  const { animations } = useSite();
  const { motionEnabled } = usePrefs();
  const { pathname, hash } = useLocation();
  const enabled = motionEnabled && animations.smooth_scroll;

  useEffect(() => {
    if (!enabled) return;
    lenis = new Lenis({ duration: 1.1 / animations.speed, smoothWheel: true, touchMultiplier: 1.2 });
    let raf = 0;
    const loop = (t: number) => {
      lenis?.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, [enabled, animations.speed]);

  // Al cambiar de página: arriba del todo o al ancla indicada
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) scrollToTarget(el);
      }, 120);
      return;
    }
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
