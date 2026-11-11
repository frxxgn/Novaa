import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUpRight, Check, Info, Plus } from "lucide-react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";
import { useI18n } from "@/i18n";
import { Markdown } from "@/lib/markdown";
import { cn, interpolate } from "@/lib/utils";
import { fetchFaqs } from "@/services/content";
import { Reveal, SplitWords } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { HeroVisual } from "@/components/three/HeroVisual";
import { scrollToTarget } from "@/components/motion/SmoothScroll";
import { arr, GlowBlob, lnk, SectionHeading, str } from "./common";
import type { SectionProps } from "../registry";

export function HeroSection({ props, style }: SectionProps) {
  const { animations } = useSite();
  const { motionEnabled } = usePrefs();
  const primary = lnk(props.primary);
  const secondary = lnk(props.secondary);
  const title = str(props.title);
  const badges = arr<string>(props.badges);
  const showVisual = str(props.visual, "orb") !== "none";
  const center = style.align === "center";

  return (
    <div className="relative isolate flex min-h-[100svh] items-center overflow-hidden pb-16 pt-28 md:pt-32">
      <div aria-hidden className="grid-lines absolute inset-0 -z-10 opacity-60" />
      <GlowBlob className="-left-40 top-10 -z-10 h-[520px] w-[520px] opacity-70" color="var(--nv-indigo)" />
      <GlowBlob className="-right-20 bottom-0 -z-10 h-[640px] w-[640px] opacity-80" />
      <div className={cn("container-nv grid items-center gap-10 lg:gap-6", showVisual && !center ? "lg:grid-cols-[1.45fr_1fr]" : "")}>
        <div className={cn("relative z-10", center && "mx-auto max-w-5xl text-center")}>
          {str(props.eyebrow) && (
            <motion.p
              initial={motionEnabled ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className={cn("eyebrow mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-lavender backdrop-blur", center && "mx-auto")}
            >
              <span className="size-1.5 rounded-full bg-secondary shadow-[0_0_10px_var(--nv-secondary)]" />
              {str(props.eyebrow)}
            </motion.p>
          )}
          <h1 className="display-xl text-balance">
            <SplitWords text={title} highlight={str(props.highlight)} delay={0.25} />
          </h1>
          {str(props.subtitle) && (
            <motion.p
              initial={motionEnabled ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 / animations.speed, delay: 0.75 }}
              className={cn("mt-8 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl", center && "mx-auto")}
            >
              {str(props.subtitle)}
            </motion.p>
          )}
          <motion.div initial={motionEnabled ? { opacity: 0, y: 16 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.95 }} className={cn("mt-10 flex flex-col gap-3 sm:flex-row", center && "justify-center")}>
            {primary && (
              <ButtonLink to={primary.href!} size="lg" magnetic iconRight={<ArrowUpRight className="size-5" />} trackId="hero_primary">
                {primary.label}
              </ButtonLink>
            )}
            {secondary && (
              <ButtonLink
                to={secondary.href!}
                size="lg"
                variant="outline"
                magnetic
                trackId="hero_secondary"
                iconRight={<ArrowDown className="size-5" />}
                onClick={(e) => {
                  if (secondary.href!.startsWith("#")) {
                    e.preventDefault();
                    scrollToTarget(secondary.href!);
                  }
                }}
              >
                {secondary.label}
              </ButtonLink>
            )}
          </motion.div>
          {badges.length > 0 && (
            <motion.ul initial={motionEnabled ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }} className={cn("mt-12 flex flex-wrap gap-2", center && "justify-center")}>
              {badges.map((b) => (
                <li key={b} className="rounded-full border border-white/12 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
                  {b}
                </li>
              ))}
            </motion.ul>
          )}
        </div>
        {showVisual && (
          <motion.div
            initial={motionEnabled ? { opacity: 0, scale: 0.85 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn("relative mx-auto w-full max-w-[560px]", center ? "absolute inset-0 -z-10 m-auto opacity-40" : "-mt-6 max-w-[420px] lg:mt-0 lg:max-w-none")}
          >
            <HeroVisual />
          </motion.div>
        )}
      </div>
      <div aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40 md:flex">
        Scroll
        <span className="h-10 w-px overflow-hidden bg-white/15">
          <motion.span className="block h-1/2 w-full bg-lavender" animate={motionEnabled ? { y: ["-100%", "200%"] } : undefined} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
        </span>
      </div>
    </div>
  );
}

export function MarqueeSection({ props }: SectionProps) {
  const items = arr<string>(props.items);
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-tone py-6 md:py-8" aria-label={items.join(", ")}>
      <div className="animate-marquee flex w-max items-center gap-10 pr-10" aria-hidden>
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl tracking-tight text-[var(--tone-fg)] md:text-4xl">
            {item}
            <svg viewBox="0 0 24 24" className="size-5 text-secondary md:size-7" aria-hidden>
              <path fill="currentColor" d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z" />
            </svg>
          </span>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[var(--nv-bg-dark)] to-transparent [.tone-light_&]:from-[var(--nv-bg-light)]" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[var(--nv-bg-dark)] to-transparent [.tone-light_&]:from-[var(--nv-bg-light)]" />
    </div>
  );
}

export function StatementSection({ props, style }: SectionProps) {
  return (
    <div className={cn("container-nv section-nv", style.align === "center" && "text-center")}>
      {str(props.eyebrow) && (
        <Reveal>
          <p className="eyebrow mb-8 text-[color-mix(in_oklab,var(--nv-secondary)_75%,var(--tone-fg))]">{str(props.eyebrow)}</p>
        </Reveal>
      )}
      <p className={cn("display-md max-w-6xl text-balance leading-[1.08]", style.align === "center" && "mx-auto")}>
        <SplitWords text={str(props.text)} highlight={str(props.highlight)} />
      </p>
      {str(props.body) && (
        <Reveal delay={0.2}>
          <p className={cn("mt-10 max-w-2xl text-lg leading-relaxed text-muted md:ml-auto md:text-xl", style.align === "center" && "mx-auto md:mx-auto")}>{str(props.body)}</p>
        </Reveal>
      )}
    </div>
  );
}

export function PageHeaderSection({ props, style }: SectionProps) {
  return (
    <div className="relative isolate overflow-hidden pb-14 pt-36 md:pb-20 md:pt-44">
      <GlowBlob className="-right-32 -top-32 -z-10 h-[520px] w-[520px] opacity-70" />
      <div aria-hidden className="grid-lines absolute inset-0 -z-10 opacity-40" />
      <div className={cn("container-nv", style.align === "center" && "text-center")}>
        {str(props.eyebrow) && (
          <Reveal>
            <p className="eyebrow mb-6 text-lavender">{str(props.eyebrow)}</p>
          </Reveal>
        )}
        <h1 className={cn("display-lg max-w-5xl text-balance", style.align === "center" && "mx-auto")}>
          <SplitWords text={str(props.title)} highlight={str(props.highlight)} />
        </h1>
        {str(props.subtitle) && (
          <Reveal delay={0.2}>
            <p className={cn("mt-7 max-w-2xl text-lg leading-relaxed text-muted md:text-xl", style.align === "center" && "mx-auto")}>{str(props.subtitle)}</p>
          </Reveal>
        )}
      </div>
    </div>
  );
}

export function RichTextSection({ props }: SectionProps) {
  const { settings } = useSite();
  const body = interpolate(str(props.body), settings as unknown as Record<string, Record<string, unknown>>);
  return (
    <div className="container-nv section-nv">
      <div className="mx-auto max-w-3xl">
        {str(props.notice) && (
          <div className="mb-10 flex items-start gap-3 rounded-sm border border-warning/40 bg-warning/10 p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>{str(props.notice)}</p>
          </div>
        )}
        {str(props.title) && <h2 className="display-md mb-8">{str(props.title)}</h2>}
        <Markdown text={body} className="prose-nv" />
      </div>
    </div>
  );
}

export function FeaturesGridSection({ props, style }: SectionProps) {
  const items = arr<{ icon?: string; title?: string; text?: string }>(props.items);
  return (
    <div className="container-nv section-nv">
      <SectionHeading eyebrow={str(props.eyebrow)} title={str(props.title)} align={style.align} size="md" />
      <ul className="mt-14 grid gap-px overflow-hidden rounded-lg border border-tone bg-[var(--tone-line)] sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <Reveal as="li" key={i} delay={(i % 3) * 0.08} className="group relative bg-[var(--nv-bg-dark)] p-8 transition-colors [.tone-light_&]:bg-[var(--nv-bg-light)] [.tone-violet_&]:bg-[var(--nv-indigo)]">
            <span className="inline-flex size-12 items-center justify-center rounded-full border border-tone text-[var(--nv-secondary)] transition-all duration-500 group-hover:scale-110 group-hover:border-transparent group-hover:bg-primary group-hover:text-white">
              <Icon name={item.icon ?? "sparkles"} className="size-5" />
            </span>
            <h3 className="mt-6 font-display text-xl tracking-tight">{item.title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{item.text}</p>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

export function CtaSection({ props, style }: SectionProps) {
  const primary = lnk(props.primary);
  const secondary = lnk(props.secondary);
  return (
    <div className="container-nv section-nv">
      <div className={cn("relative overflow-hidden rounded-lg border border-tone px-6 py-16 md:px-16 md:py-24", style.tone !== "violet" && "glass", style.align !== "left" && "text-center")}>
        <GlowBlob className="-bottom-40 -right-20 h-96 w-96 opacity-60" color="var(--nv-secondary)" />
        <h2 className={cn("display-lg relative max-w-4xl text-balance", style.align !== "left" && "mx-auto")}>
          <SplitWords text={str(props.title)} />
        </h2>
        {str(props.text) && (
          <Reveal delay={0.15}>
            <p className={cn("relative mt-6 max-w-xl text-lg text-muted", style.align !== "left" && "mx-auto")}>{str(props.text)}</p>
          </Reveal>
        )}
        <Reveal delay={0.25} className={cn("relative mt-10 flex flex-col gap-3 sm:flex-row", style.align !== "left" && "justify-center")}>
          {primary && (
            <ButtonLink to={primary.href!} size="lg" magnetic iconRight={<ArrowUpRight className="size-5" />} trackId="cta_primary">
              {primary.label}
            </ButtonLink>
          )}
          {secondary && (
            <ButtonLink to={secondary.href!} size="lg" variant="outline" magnetic trackId="cta_secondary">
              {secondary.label}
            </ButtonLink>
          )}
        </Reveal>
      </div>
    </div>
  );
}

export function MediaSection({ props }: SectionProps) {
  const src = str(props.src);
  if (!src) return null;
  const isVideo = /\.(mp4|webm)(\?|$)/i.test(src);
  return (
    <div className="container-nv section-nv">
      <Reveal>
        <figure>
          <div className="overflow-hidden rounded-lg border border-tone" style={{ aspectRatio: str(props.aspect, "16/9") }}>
            {isVideo ? <video src={src} className="size-full object-cover" autoPlay muted loop playsInline aria-label={str(props.alt)} /> : <img src={src} alt={str(props.alt)} loading="lazy" decoding="async" className="size-full object-cover" />}
          </div>
          {str(props.caption) && <figcaption className="mt-3 text-sm text-muted">{str(props.caption)}</figcaption>}
        </figure>
      </Reveal>
    </div>
  );
}

export function SplitSection({ props }: SectionProps) {
  const src = str(props.image);
  const isVideo = /\.(mp4|webm)(\?|$)/i.test(src);
  const cta = lnk(props.cta);
  return (
    <div className="container-nv section-nv">
      <div className={cn("grid items-center gap-12 lg:grid-cols-2 lg:gap-20", props.reverse ? "lg:[&>*:first-child]:order-2" : "")}>
        <div>
          {str(props.eyebrow) && <p className="eyebrow mb-5 text-[color-mix(in_oklab,var(--nv-secondary)_75%,var(--tone-fg))]">{str(props.eyebrow)}</p>}
          <h2 className="display-md">
            <SplitWords text={str(props.title)} />
          </h2>
          {str(props.text) && (
            <Reveal delay={0.1}>
              <Markdown text={str(props.text)} className="prose-nv mt-6" />
            </Reveal>
          )}
          {arr<string>(props.bullets).length > 0 && (
            <ul className="mt-6 space-y-3">
              {arr<string>(props.bullets).map((b) => (
                <li key={b} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-secondary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {cta && (
            <ButtonLink to={cta.href!} className="mt-8" iconRight={<ArrowUpRight className="size-4" />}>
              {cta.label}
            </ButtonLink>
          )}
        </div>
        <Reveal>
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-tone bg-[linear-gradient(135deg,var(--nv-indigo),var(--nv-primary))]">
            {src && (isVideo ? <video src={src} className="size-full object-cover" autoPlay muted loop playsInline /> : <img src={src} alt={str(props.image_alt)} loading="lazy" className="size-full object-cover" />)}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export function FaqSection({ props, style }: SectionProps) {
  const scope = str(props.scope, "general");
  const { tr } = useI18n();
  const faqs = useQuery({ queryKey: ["faqs", scope], queryFn: () => fetchFaqs(scope), staleTime: 120_000 });
  const [open, setOpen] = useState<string | null>(null);
  const items = faqs.data ?? [];
  const jsonLd = items.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) } : null;
  return (
    <div className="container-nv section-nv">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading eyebrow={str(props.eyebrow)} title={str(props.title)} align={style.align} size="md" />
        <ul className="divide-y divide-[var(--tone-line)] border-y border-tone">
          {faqs.isLoading && <li className="py-6 text-muted">Cargando…</li>}
          {items.map((f, i) => {
            const isOpen = open === f.id;
            return (
              <Reveal as="li" key={f.id} delay={i * 0.04}>
                <button className="flex w-full items-center justify-between gap-6 py-6 text-left" onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen} data-cursor="button">
                  <span className="font-display text-lg tracking-tight md:text-xl">{tr(f, "question")}</span>
                  <Plus className={cn("size-5 shrink-0 transition-transform duration-500", isOpen && "rotate-45")} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <p className="max-w-2xl pb-6 leading-relaxed text-muted">{tr(f, "answer")}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            );
          })}
        </ul>
      </div>
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </div>
  );
}
