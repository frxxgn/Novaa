import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";

/** Aparición al hacer scroll según el efecto configurado en el panel. */
export function Reveal({ children, delay = 0, className, as = "div", y = 28 }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "span"; y?: number }) {
  const { animations } = useSite();
  const { motionEnabled } = usePrefs();
  if (!motionEnabled || animations.scroll_reveal === "none") {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const k = animations.intensity;
  const hidden = {
    rise: { opacity: 0, y: y * k },
    fade: { opacity: 0 },
    blur: { opacity: 0, filter: "blur(12px)", y: 10 * k },
    scale: { opacity: 0, scale: 1 - 0.06 * k },
  }[animations.scroll_reveal];
  const variants: Variants = {
    hidden,
    visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 0.9 / animations.speed, delay, ease: [0.16, 1, 0.3, 1] } },
  };
  const M = motion[as];
  return (
    <M className={className} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "0px 0px -12% 0px" }} variants={variants}>
      {children}
    </M>
  );
}

/** Texto que entra palabra a palabra. */
export function SplitWords({ text, className, highlight, delay = 0 }: { text: string; className?: string; highlight?: string; delay?: number }) {
  const { animations } = useSite();
  const { motionEnabled } = usePrefs();
  const words = text.split(/\s+/);
  // Resalta la primera aparición de la frase indicada (no cada palabra suelta)
  const norm = (w: string) => w.toLowerCase().replace(/[.,;:!?¿¡«»"]/g, "");
  const hl = (highlight ?? "").split(/\s+/).filter(Boolean).map(norm);
  const hlSet = new Set<number>();
  if (hl.length) {
    for (let i = 0; i + hl.length <= words.length; i++) {
      if (hl.every((h, j) => norm(words[i + j]!) === h)) {
        hl.forEach((_, j) => hlSet.add(i + j));
        break;
      }
    }
  }
  const isHlAt = (i: number) => hlSet.has(i);
  if (!motionEnabled) {
    return (
      <span className={className}>
        {words.map((w, i) => (
          <span key={i} className={isHlAt(i) ? "text-gradient" : undefined}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden>
          <span className="inline-block overflow-hidden whitespace-nowrap pb-[0.08em] align-bottom">
            <motion.span
              className={`inline-block ${isHlAt(i) ? "text-gradient" : ""}`}
              initial={{ y: "105%", rotate: 4 * animations.intensity }}
              whileInView={{ y: "0%", rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.95 / animations.speed, delay: delay + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
