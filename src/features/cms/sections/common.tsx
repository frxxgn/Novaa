import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SplitWords } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";

export interface LinkValue {
  label?: string;
  href?: string;
}

export const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
export const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const lnk = (v: unknown): LinkValue | null => {
  if (!v || typeof v !== "object") return null;
  const l = v as LinkValue;
  return l.label && l.href ? l : null;
};

export function SectionHeading({ eyebrow, title, subtitle, align = "left", cta, className, size = "lg" }: { eyebrow?: string; title?: string; subtitle?: string; align?: "left" | "center"; cta?: LinkValue | null; className?: string; size?: "lg" | "md" }) {
  if (!eyebrow && !title && !subtitle) return null;
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", align === "center" && "items-center text-center md:flex-col md:items-center", className)}>
      <div className={cn("max-w-3xl", align === "center" && "mx-auto")}>
        {eyebrow && (
          <Reveal>
            <p className="eyebrow mb-5 inline-flex items-center gap-2 text-[color-mix(in_oklab,var(--nv-secondary)_75%,var(--tone-fg))]">
              <span className="h-px w-6 bg-current" />
              {eyebrow}
            </p>
          </Reveal>
        )}
        {title && (
          <h2 className={size === "lg" ? "display-lg" : "display-md"}>
            <SplitWords text={title} />
          </h2>
        )}
        {subtitle && (
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{subtitle}</p>
          </Reveal>
        )}
      </div>
      {cta && (
        <Reveal delay={0.2} className="shrink-0">
          <ButtonLink to={cta.href!} variant="outline" iconRight={<ArrowUpRight className="size-4" />} magnetic>
            {cta.label}
          </ButtonLink>
        </Reveal>
      )}
    </div>
  );
}

export function GlowBlob({ className, color = "var(--nv-primary)" }: { className?: string; color?: string }): ReactNode {
  return <div aria-hidden className={cn("pointer-events-none absolute rounded-full blur-3xl", className)} style={{ background: `radial-gradient(closest-side, color-mix(in oklab, ${color} 55%, transparent), transparent)` }} />;
}
