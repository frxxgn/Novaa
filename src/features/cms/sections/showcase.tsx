import { useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { ArrowUpRight, Gamepad2, Grid3x3, MessageCircle, Timer } from "lucide-react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { fetchProjects, fetchServices, fetchTemplates } from "@/services/content";
import { Reveal, SplitWords } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/feedback";
import { NovaAvatar } from "@/components/brand/Logo";
import { openNova } from "@/features/nova/NovaWidget";
import { ServiceVisual } from "@/features/services/ServiceVisual";
import { TemplatePreview } from "@/features/templates/TemplatePreview";
import { ProjectCover } from "@/features/portfolio/ProjectCover";
import { arr, GlowBlob, lnk, SectionHeading, str } from "./common";
import type { SectionProps } from "../registry";

export function ServicesShowcaseSection({ props, style }: SectionProps) {
  const services = useQuery({ queryKey: ["services"], queryFn: fetchServices, staleTime: 120_000 });
  const { tr } = useI18n();
  const [active, setActive] = useState(0);
  const list = services.data ?? [];
  const current = list[active];

  return (
    <div className="container-nv section-nv">
      <SectionHeading eyebrow={str(props.eyebrow)} title={str(props.title)} subtitle={str(props.subtitle)} cta={lnk(props.cta)} align={style.align} />
      {services.isLoading && <Skeleton className="mt-16 h-96 text-white" />}
      {/* Escritorio: lista interactiva + panel fijo */}
      <div className="mt-16 hidden gap-12 lg:grid lg:grid-cols-[1.15fr_1fr]">
        <ol className="border-t border-tone">
          {list.map((s, i) => (
            <li key={s.id}>
              <Link
                to={`/servicios/${s.slug}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className="group flex items-center gap-6 border-b border-tone py-5 transition-colors"
                data-cursor="card"
                data-cursor-label="Ver"
              >
                <span className="w-8 font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className={cn("flex-1 font-display text-2xl tracking-tight transition-all duration-500 xl:text-[1.9rem]", active === i ? "translate-x-2 text-[var(--tone-fg)]" : "text-[var(--tone-muted)]")}>{tr(s, "title")}</span>
                <ArrowUpRight className={cn("size-5 transition-all duration-500", active === i ? "translate-x-0 opacity-100 text-secondary" : "-translate-x-2 opacity-0")} />
              </Link>
            </li>
          ))}
        </ol>
        <div className="relative">
          <div className="sticky top-28">
            <AnimatePresence mode="wait">
              {current && (
                <motion.div key={current.id} initial={{ opacity: 0, y: 20, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.45 }} className="glass overflow-hidden rounded-lg">
                  <ServiceVisual kind={current.visual} accent={current.accent} className="rounded-none" />
                  <div className="p-7">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-white">
                        <Icon name={current.icon} className="size-5" />
                      </span>
                      <p className="font-display text-xl">{tr(current, "tagline")}</p>
                    </div>
                    <p className="mt-4 leading-relaxed text-muted">{tr(current, "summary")}</p>
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {current.features.slice(0, 4).map((f) => (
                        <li key={f.title} className="rounded-full border border-tone px-3 py-1 text-xs text-muted">
                          {f.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {/* Móvil: carrusel táctil */}
      <div className="-mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none lg:hidden" data-lenis-prevent>
        {list.map((s) => (
          <Link key={s.id} to={`/servicios/${s.slug}`} className="glass w-[82%] shrink-0 snap-center overflow-hidden rounded-lg sm:w-[46%]">
            <ServiceVisual kind={s.visual} accent={s.accent} className="rounded-none" />
            <div className="p-5">
              <p className="font-display text-xl">{tr(s, "title")}</p>
              <p className="mt-2 text-sm text-muted">{tr(s, "tagline")}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProcessSection({ props, style }: SectionProps) {
  const steps = arr<{ title: string; text: string }>(props.steps);
  const ref = useRef<HTMLDivElement>(null);
  const { motionEnabled } = usePrefs();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${Math.max(0, steps.length - 2.4) * (100 / Math.max(steps.length, 1))}%`]);
  const progress = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div>
      <div className="container-nv pt-[calc(var(--nv-section-space)*0.55)] md:pt-[calc(var(--nv-section-space)*0.8)]">
        <SectionHeading eyebrow={str(props.eyebrow)} title={str(props.title)} subtitle={str(props.subtitle)} align={style.align} />
      </div>
      {/* Escritorio: recorrido horizontal ligado al scroll */}
      {motionEnabled ? (
        <div ref={ref} className="relative hidden lg:block" style={{ height: `${Math.max(140, steps.length * 30)}vh` }}>
          <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
            <motion.ol style={{ x }} className="flex gap-6 pl-[max(16px,calc((100vw-var(--nv-container))/2+var(--nv-gutter)))]">
              {steps.map((s, i) => (
                <li key={i} className="glass relative flex h-[360px] w-[420px] shrink-0 flex-col justify-between rounded-lg p-9">
                  <span className="font-display text-[5.5rem] leading-none tracking-tighter text-gradient">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-display text-2xl tracking-tight">{s.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted">{s.text}</p>
                  </div>
                </li>
              ))}
            </motion.ol>
            <div className="container-nv mt-12">
              <div className="h-px w-full bg-[var(--tone-line)]">
                <motion.div className="h-px bg-gradient-to-r from-primary to-secondary" style={{ width: progress }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {/* Móvil (y movimiento reducido): línea de tiempo vertical */}
      <ol className={cn("container-nv pb-[calc(var(--nv-section-space)*0.55)] pt-12", motionEnabled && "lg:hidden")}>
        {steps.map((s, i) => (
          <Reveal as="li" key={i} className="relative border-l border-tone pb-10 pl-8 last:pb-0">
            <span className="absolute -left-[13px] top-0 inline-flex size-[26px] items-center justify-center rounded-full bg-primary font-mono text-[10px] text-white">{i + 1}</span>
            <h3 className="font-display text-xl tracking-tight">{s.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

export function NovaCtaSection({ props, style }: SectionProps) {
  const prompts = arr<string>(props.prompts);
  return (
    <div id="nova" className="container-nv section-nv scroll-mt-24">
      <div className="relative overflow-hidden rounded-lg border border-tone">
        <GlowBlob className="-left-20 -top-20 h-96 w-96 opacity-80" />
        <GlowBlob className="-bottom-32 right-0 h-[28rem] w-[28rem] opacity-60" color="var(--nv-secondary)" />
        <div className={cn("relative grid items-center gap-12 p-7 md:p-14 lg:grid-cols-[1.1fr_1fr]", style.align === "center" && "text-center lg:grid-cols-1")}>
          <div>
            {str(props.eyebrow) && <p className="eyebrow mb-5 text-lavender">{str(props.eyebrow)}</p>}
            <h2 className="display-lg">
              <SplitWords text={str(props.title)} highlight="Nova" />
            </h2>
            {str(props.text) && <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{str(props.text)}</p>}
            <div className="mt-8 flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button key={p} onClick={() => openNova(p)} className="rounded-full border border-tone px-4 py-2 text-sm transition-colors hover:border-lavender hover:bg-white/5" data-cursor="button">
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Reveal>
            <button onClick={() => openNova()} className="group relative mx-auto block w-full max-w-sm text-left" data-cursor="card" data-cursor-label="Hablar">
              <div className="glass rounded-lg p-5 shadow-2xl transition-transform duration-700 group-hover:-translate-y-1 group-hover:rotate-[-1deg]">
                <div className="flex items-center gap-3 border-b border-tone pb-4">
                  <NovaAvatar className="size-10" pulse />
                  <div>
                    <p className="font-display">Nova</p>
                    <p className="text-xs text-muted">Asistente de Novalius</p>
                  </div>
                </div>
                <div className="space-y-3 py-5 text-sm">
                  <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-2.5">¿Qué quieres construir o mejorar en tu negocio?</p>
                  <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-white">{prompts[0] ?? "Quiero una web nueva"}</p>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[color-mix(in_oklab,var(--nv-secondary)_40%,transparent)] bg-[color-mix(in_oklab,var(--nv-primary)_18%,transparent)] px-4 py-3">
                    <p className="eyebrow text-[10px] text-lavender">Estimación orientativa</p>
                    <div className="mt-2 h-5 w-40 rounded-md bg-white/20" />
                    <div className="mt-2 h-2 w-28 rounded-full bg-white/10" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-full border border-tone py-2 pl-4 pr-2 text-sm text-muted">
                  Escribe a Nova…
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-white">
                    <MessageCircle className="size-4" />
                  </span>
                </div>
              </div>
            </button>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

export function ChallengeTeaserSection({ props, style }: SectionProps) {
  const cta = lnk(props.cta);
  const { settings } = useSite();
  return (
    <div className="container-nv section-nv">
      <div className={cn("grid items-center gap-12 lg:grid-cols-2", style.align === "center" && "text-center lg:grid-cols-1")}>
        <div>
          {str(props.eyebrow) && <p className="eyebrow mb-5 text-lavender">{str(props.eyebrow)}</p>}
          <h2 className="display-lg">
            <SplitWords text={str(props.title)} />
          </h2>
          {str(props.text) && <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{str(props.text)}</p>}
          {cta && (
            <ButtonLink to={cta.href!} size="lg" variant="light" magnetic className="mt-10" iconRight={<Gamepad2 className="size-5" />} trackId="challenge_teaser">
              {cta.label}
            </ButtonLink>
          )}
        </div>
        <Reveal>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-lg p-6">
              <Timer className="size-7 text-lavender" />
              <p className="mt-10 font-display text-5xl tracking-tighter">
                {settings.challenge.quiz_questions}
                <span className="text-xl text-muted"> / {settings.challenge.quiz_duration_seconds}s</span>
              </p>
              <p className="mt-2 text-sm text-muted">Quiz relámpago</p>
            </div>
            <div className="glass rounded-lg p-6">
              <Grid3x3 className="size-7 text-lavender" />
              <div className="mt-6 grid w-24 grid-cols-3 gap-1">
                {["X", "O", "", "", "X", "O", "", "", "X"].map((c, i) => (
                  <span key={i} className="flex size-7 items-center justify-center rounded-md bg-white/10 font-display text-sm">
                    {c}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">Tres en raya contra Nova</p>
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg bg-white p-6 text-ink">
              <div>
                <p className="eyebrow text-primary">Recompensa</p>
                <p className="font-display text-3xl tracking-tight">−{settings.challenge.coupon_percent} %</p>
              </div>
              <p className="max-w-[55%] text-right text-sm text-ink/70">Cupón único por cuenta para tu próximo proyecto.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export function TemplatesTeaserSection({ props, style }: SectionProps) {
  const templates = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates, staleTime: 120_000 });
  const { t } = useI18n();
  const limit = Number(props.limit ?? 6) || 6;
  const list = (templates.data ?? []).slice(0, limit);
  return (
    <div className="container-nv section-nv">
      <SectionHeading eyebrow={str(props.eyebrow)} title={str(props.title)} subtitle={str(props.subtitle)} cta={lnk(props.cta)} align={style.align} />
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[4/3]" />)}
        {list.map((tpl, i) => (
          <Reveal key={tpl.id} delay={(i % 3) * 0.08}>
            <Link to={`/plantillas/${tpl.slug}`} className="group block" data-cursor="card" data-cursor-label="Abrir">
              <div className="overflow-hidden rounded-md border border-tone shadow-[0_30px_60px_-40px_rgba(16,10,60,.6)] transition-transform duration-700 group-hover:-translate-y-1.5">
                <div className="flex items-center gap-1.5 border-b border-tone bg-[var(--tone-card)] px-3 py-2">
                  <span className="size-2 rounded-full bg-[var(--tone-line)]" />
                  <span className="size-2 rounded-full bg-[var(--tone-line)]" />
                  <span className="size-2 rounded-full bg-[var(--tone-line)]" />
                  <span className="ml-2 truncate font-mono text-[10px] text-muted">{t("common.demo")} · {tpl.content.brand}</span>
                </div>
                <TemplatePreview template={tpl} />
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg">{tpl.name}</p>
                  <p className="text-sm text-muted">{tpl.category}</p>
                </div>
                <ArrowUpRight className="size-5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export function PortfolioTeaserSection({ props, style }: SectionProps) {
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, staleTime: 120_000 });
  const { t, tr } = useI18n();
  const limit = Number(props.limit ?? 4) || 4;
  const list = (projects.data ?? []).slice(0, limit);
  return (
    <div className="container-nv section-nv">
      <SectionHeading eyebrow={str(props.eyebrow)} title={str(props.title)} subtitle={str(props.subtitle)} cta={lnk(props.cta)} align={style.align} />
      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {list.map((p, i) => (
          <Reveal key={p.id} delay={(i % 2) * 0.1} className={i === 0 ? "md:col-span-2" : ""}>
            <Link to={`/proyectos/${p.slug}`} className="group block" data-cursor="card" data-cursor-label="Ver">
              <div className={cn("overflow-hidden rounded-lg border border-tone", i === 0 ? "aspect-[16/9] md:aspect-[21/9]" : "aspect-[4/3]")}>
                <ProjectCover project={p} className="transition-transform duration-1000 group-hover:scale-[1.03]" />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-2xl tracking-tight">{tr(p, "title")}</p>
                  <p className="mt-1 text-sm text-muted">{p.category}</p>
                </div>
                <span className={cn("rounded-full border px-3 py-1 text-xs", p.is_concept ? "border-warning/50 text-warning" : "border-tone text-muted")}>{p.is_concept ? t("common.concept") : p.client_label || "Proyecto"}</span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
