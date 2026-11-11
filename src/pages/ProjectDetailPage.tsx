import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Info } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSeo } from "@/hooks/useSeo";
import { fetchProject } from "@/services/content";
import { Reveal, SplitWords } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { ProjectCover } from "@/features/portfolio/ProjectCover";
import NotFound from "./NotFound";

export default function ProjectDetailPage() {
  const { slug = "" } = useParams();
  const { t, tr } = useI18n();
  const q = useQuery({ queryKey: ["project", slug], queryFn: () => fetchProject(slug) });
  const p = q.data;
  useSeo({ title: p?.seo?.title || p?.title, description: p?.seo?.description || p?.summary, image: p?.cover_url || undefined, type: "article" });

  if (q.isLoading) return <div className="container-nv py-40"><Skeleton className="h-96" /></div>;
  if (q.error) return <div className="container-nv py-40"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  if (!p) return <NotFound />;

  return (
    <>
      <section className="tone-dark pb-12 pt-32 md:pt-40">
        <div className="container-nv">
          <Link to="/proyectos" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white">
            <ArrowLeft className="size-4" /> Proyectos
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className={p.is_concept ? "rounded-full border border-warning/50 px-3 py-1 text-xs text-warning" : "rounded-full border border-success/50 px-3 py-1 text-xs text-success"}>{p.is_concept ? t("common.concept") : p.client_label}</span>
            <span className="text-sm text-muted">
              {p.category}
              {p.year ? ` · ${p.year}` : ""}
            </span>
          </div>
          <h1 className="display-lg mt-6 max-w-5xl text-balance">
            <SplitWords text={tr(p, "title")} />
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{tr(p, "summary")}</p>
          {p.is_concept && (
            <p className="mt-6 flex max-w-2xl items-start gap-2 rounded-sm border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <Info className="mt-0.5 size-4 shrink-0" /> Proyecto conceptual de laboratorio: no corresponde a un cliente real. Muestra capacidades de Novalius.
            </p>
          )}
        </div>
      </section>
      <section className="tone-dark pb-16">
        <div className="container-nv">
          <Reveal>
            <div className="aspect-[16/9] overflow-hidden rounded-lg border border-tone">
              {p.video_url ? <video src={p.video_url} className="size-full object-cover" autoPlay muted loop playsInline /> : <ProjectCover project={p} />}
            </div>
          </Reveal>
        </div>
      </section>
      <section className="tone-light section-nv">
        <div className="container-nv grid gap-12 md:grid-cols-3">
          {[
            [t("portfolio.challenge"), tr(p, "challenge")],
            [t("portfolio.solution"), tr(p, "solution")],
            [t("portfolio.outcome"), tr(p, "outcome")],
          ]
            .filter(([, v]) => v)
            .map(([k, v], i) => (
              <Reveal key={k} delay={i * 0.08}>
                <p className="eyebrow text-primary">{k}</p>
                <p className="mt-4 text-lg leading-relaxed">{v}</p>
              </Reveal>
            ))}
        </div>
        <div className="container-nv mt-16 grid gap-12 md:grid-cols-2">
          {p.features.length > 0 && (
            <div>
              <p className="eyebrow text-primary">Funcionalidades destacadas</p>
              <ul className="mt-5 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="border-b border-tone pb-3">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.stack.length > 0 && (
            <div>
              <p className="eyebrow text-primary">{t("portfolio.stack")}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {p.stack.map((s) => (
                  <li key={s} className="rounded-full border border-tone px-4 py-2 text-sm">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {p.gallery.length > 0 && (
          <div className="container-nv mt-16 grid gap-6 md:grid-cols-2">
            {p.gallery.map((g) => (
              <figure key={g.url} className="overflow-hidden rounded-lg border border-tone">
                {g.kind === "video" ? <video src={g.url} controls className="w-full" /> : <img src={g.url} alt={g.alt} loading="lazy" className="w-full" />}
              </figure>
            ))}
          </div>
        )}
        <div className="container-nv mt-16 flex flex-wrap gap-3">
          {p.demo_url && (
            <ButtonLink to={p.demo_url} iconRight={<ArrowUpRight className="size-4" />}>
              {t("portfolio.view_demo")}
            </ButtonLink>
          )}
          <ButtonLink to="/contacto?intent=propuesta" variant="outline">
            {t("cta.proposal")}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
