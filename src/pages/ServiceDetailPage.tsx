import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowUpRight, Check, MessageCircle, Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSeo } from "@/hooks/useSeo";
import { cn } from "@/lib/utils";
import { fetchService, fetchServices } from "@/services/content";
import { Reveal, SplitWords } from "@/components/motion/Reveal";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { ServiceVisual } from "@/features/services/ServiceVisual";
import { openNova } from "@/features/nova/NovaWidget";
import { GlowBlob } from "@/features/cms/sections/common";
import NotFound from "./NotFound";

export default function ServiceDetailPage() {
  const { slug = "" } = useParams();
  const { t, tr } = useI18n();
  const q = useQuery({ queryKey: ["service", slug], queryFn: () => fetchService(slug) });
  const all = useQuery({ queryKey: ["services"], queryFn: fetchServices, staleTime: 120_000 });
  const [open, setOpen] = useState<string | null>(null);
  const s = q.data?.service;

  useSeo({
    title: s?.seo?.title || s?.title,
    description: s?.seo?.description || s?.summary,
    jsonLd: s ? { "@context": "https://schema.org", "@type": "Service", name: s.title, description: s.summary, provider: { "@type": "Organization", name: "Novalius" }, areaServed: "ES" } : undefined,
  });

  if (q.isLoading) return <div className="container-nv py-40"><Skeleton className="h-96" /></div>;
  if (q.error) return <div className="container-nv py-40"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  if (!s) return <NotFound />;

  const others = (all.data ?? []).filter((x) => x.id !== s.id).slice(0, 3);
  const index = (all.data ?? []).findIndex((x) => x.id === s.id);

  return (
    <>
      <section className="tone-dark relative isolate overflow-hidden pb-16 pt-32 md:pt-40">
        <GlowBlob className="-right-40 -top-20 -z-10 h-[620px] w-[620px] opacity-70" color={s.accent || "var(--nv-primary)"} />
        <div className="container-nv grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Link to="/servicios" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white">
              <ArrowLeft className="size-4" /> {t("services.all")}
            </Link>
            <p className="eyebrow mt-8 flex items-center gap-3 text-lavender">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/10">
                <Icon name={s.icon} className="size-4" />
              </span>
              {index >= 0 ? `Servicio ${String(index + 1).padStart(2, "0")}` : "Servicio"}
            </p>
            <h1 className="display-lg mt-6 text-balance">
              <SplitWords text={tr(s, "title")} />
            </h1>
            <p className="mt-6 font-display text-2xl text-lavender">{tr(s, "tagline")}</p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{tr(s, "summary")}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" magnetic icon={<MessageCircle className="size-5" />} onClick={() => openNova(`Me interesa el servicio «${s.title}». ¿Me ayudas a estimar el presupuesto?`)} trackId={`service_nova_${s.slug}`}>
                {t("services.estimate")}
              </Button>
              <ButtonLink to={`/contacto?intent=propuesta&servicio=${s.slug}`} size="lg" variant="outline" magnetic iconRight={<ArrowUpRight className="size-5" />}>
                {s.cta_label || t("cta.proposal")}
              </ButtonLink>
            </div>
          </div>
          <Reveal>
            <ServiceVisual kind={s.visual} accent={s.accent} className="rounded-lg border border-white/10 shadow-2xl" />
          </Reveal>
        </div>
      </section>

      <section className="tone-light section-nv">
        <div className="container-nv grid gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-primary">{t("services.problem")}</p>
            <p className="display-md mt-5 text-balance">{tr(s, "problem")}</p>
          </Reveal>
          <div>
            <p className="eyebrow text-primary">{t("services.benefits")}</p>
            <ul className="mt-6 space-y-4">
              {s.benefits.map((b, i) => (
                <Reveal as="li" key={b} delay={i * 0.06} className="flex items-start gap-4 border-b border-tone pb-4 text-lg">
                  <span className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="size-3.5" />
                  </span>
                  {b}
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="tone-dark section-nv">
        <div className="container-nv">
          <p className="eyebrow text-lavender">{t("services.features")}</p>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-tone bg-[var(--tone-line)] sm:grid-cols-2 lg:grid-cols-3">
            {s.features.map((f, i) => (
              <Reveal as="li" key={f.title} delay={(i % 3) * 0.06} className="bg-[var(--nv-bg-dark)] p-8">
                <span className="font-mono text-xs text-lavender">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 font-display text-xl">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{f.description}</p>
              </Reveal>
            ))}
          </ul>
          {s.examples.length > 0 && (
            <div className="mt-16">
              <p className="eyebrow text-lavender">{t("services.examples")}</p>
              <ul className="mt-6 flex flex-wrap gap-3">
                {s.examples.map((e) => (
                  <li key={e} className="rounded-full border border-tone px-5 py-2.5 text-sm">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {(q.data?.faqs.length ?? 0) > 0 && (
        <section className="tone-light section-nv">
          <div className="container-nv grid gap-12 lg:grid-cols-[1fr_1.6fr]">
            <h2 className="display-md">{t("services.faq")}</h2>
            <ul className="divide-y divide-[var(--tone-line)] border-y border-tone">
              {q.data!.faqs.map((f) => (
                <li key={f.id}>
                  <button className="flex w-full items-center justify-between gap-6 py-6 text-left" onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id}>
                    <span className="font-display text-lg">{tr(f, "question")}</span>
                    <Plus className={cn("size-5 shrink-0 transition-transform", open === f.id && "rotate-45")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open === f.id && (
                      <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-6 text-muted">
                        {tr(f, "answer")}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </li>
              ))}
            </ul>
          </div>
          <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: q.data!.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) })}</script>
        </section>
      )}

      <section className="tone-violet section-nv">
        <div className="container-nv">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <h2 className="display-lg max-w-3xl">
              <SplitWords text="¿Te preparamos una propuesta?" />
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={`/contacto?intent=propuesta&servicio=${s.slug}`} size="lg" variant="light" magnetic>
                {t("cta.proposal")}
              </ButtonLink>
              <Button size="lg" variant="outline" onClick={() => openNova(`Quiero información sobre ${s.title}.`)}>
                {t("cta.nova")}
              </Button>
            </div>
          </div>
          {others.length > 0 && (
            <ul className="mt-20 grid gap-4 md:grid-cols-3">
              {others.map((o) => (
                <li key={o.id}>
                  <Link to={`/servicios/${o.slug}`} className="glass group flex items-center justify-between gap-4 rounded-md p-5" data-cursor="card">
                    <span>
                      <span className="block font-display text-lg">{tr(o, "title")}</span>
                      <span className="text-sm text-muted">{tr(o, "tagline")}</span>
                    </span>
                    <ArrowUpRight className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
