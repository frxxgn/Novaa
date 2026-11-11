import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";

/** Atrae suavemente el elemento hacia el cursor (solo punteros finos). */
export function Magnetic({ children, strength, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { animations, tokens } = useSite();
  const { motionEnabled } = usePrefs();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  const active = motionEnabled && tokens.buttons.magnetic && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  const k = (strength ?? animations.magnetic_strength) * animations.intensity;

  return (
    <motion.span
      ref={ref}
      className={className ?? "inline-flex"}
      style={active ? { x: sx, y: sy } : undefined}
      onPointerMove={(e) => {
        if (!active || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * k);
        y.set((e.clientY - (r.top + r.height / 2)) * k);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}
