import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";

/**
 * Cursor magnético: punto + anillo que reacciona a botones, enlaces y tarjetas.
 * No se muestra en dispositivos táctiles ni con movimiento reducido.
 */
export function Cursor() {
  const { animations } = useSite();
  const { motionEnabled } = usePrefs();
  const [fine, setFine] = useState(false);
  const [mode, setMode] = useState<"default" | "button" | "link" | "card" | "text" | "hidden">("default");
  const [label, setLabel] = useState("");
  const [down, setDown] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 350, damping: 30, mass: 0.5 });
  const ry = useSpring(y, { stiffness: 350, damping: 30, mass: 0.5 });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (hover: hover)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const active = fine && motionEnabled && animations.cursor;

  useEffect(() => {
    document.documentElement.classList.toggle("nv-cursor", active);
    if (!active) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-cursor], a, button, input, textarea, select, [role=button]");
      if (!el) {
        setMode("default");
        setLabel("");
        return;
      }
      const kind = el.dataset.cursor;
      if (el.matches("input, textarea, select, [contenteditable]")) setMode("text");
      else if (kind === "card") setMode("card");
      else if (kind === "hidden") setMode("hidden");
      else if (el.matches("button, [role=button]") || kind === "button") setMode("button");
      else setMode("link");
      setLabel(el.dataset.cursorLabel ?? "");
    };
    const leave = () => setMode("hidden");
    const enter = () => setMode("default");
    const pd = () => setDown(true);
    const pu = () => setDown(false);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseleave", leave);
    document.addEventListener("mouseenter", enter);
    window.addEventListener("pointerdown", pd);
    window.addEventListener("pointerup", pu);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("mouseenter", enter);
      window.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointerup", pu);
      document.documentElement.classList.remove("nv-cursor");
    };
  }, [active, x, y]);

  if (!active) return null;

  const ring = {
    default: { size: 34, opacity: 0.55, bg: "transparent" },
    link: { size: 56, opacity: 0.9, bg: "color-mix(in oklab, var(--nv-secondary) 14%, transparent)" },
    button: { size: 72, opacity: 1, bg: "color-mix(in oklab, var(--nv-secondary) 22%, transparent)" },
    card: { size: label ? 96 : 84, opacity: 1, bg: "color-mix(in oklab, var(--nv-primary) 85%, transparent)" },
    text: { size: 6, opacity: 0, bg: "transparent" },
    hidden: { size: 0, opacity: 0, bg: "transparent" },
  }[mode];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[400]">
      <motion.div className="fixed left-0 top-0 size-1.5 rounded-full bg-white mix-blend-difference" style={{ x, y, translateX: "-50%", translateY: "-50%", opacity: mode === "hidden" || mode === "text" ? 0 : 1 }} />
      <motion.div
        className="fixed left-0 top-0 flex items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--nv-lavender)_70%,transparent)] text-[10px] font-medium uppercase tracking-widest text-white backdrop-blur-[1px]"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%" }}
        animate={{ width: ring.size * (down ? 0.85 : 1), height: ring.size * (down ? 0.85 : 1), opacity: ring.opacity, backgroundColor: ring.bg, borderRadius: mode === "button" ? "999px" : "999px" }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
      >
        {mode === "card" && <span className="px-2 text-center">{label || "Ver"}</span>}
      </motion.div>
    </div>
  );
}
