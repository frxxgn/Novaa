import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { fetchServices } from "@/services/content";
import { Reveal } from "@/components/motion/Reveal";
import { Icon } from "@/components/ui/Icon";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { ServiceVisual } from "./ServiceVisual";

export default function ServicesIndex() {
  const { tr } = useI18n();
  const q = useQuery({ queryKey: ["services"], queryFn: fetchServices, staleTime: 120_000 });
  return (
    <div className="container-nv pb-[calc(var(--nv-section-space)*0.6)]">
      {q.isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      )}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((s, i) => (
          <Reveal as="li" key={s.id} delay={(i % 3) * 0.07}>
            <Link to={`/servicios/${s.slug}`} className="glass group flex h-full flex-col overflow-hidden rounded-lg transition-transform duration-500 hover:-translate-y-1" data-cursor="card" data-cursor-label="Ver">
              <ServiceVisual kind={s.visual} accent={s.accent} className="rounded-none" />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/[0.08] text-lavender transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon name={s.icon} className="size-4" />
                  </span>
                  <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h2 className="mt-5 font-display text-2xl tracking-tight">{tr(s, "title")}</h2>
                <p className="mt-2 text-sm text-lavender">{tr(s, "tagline")}</p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">{tr(s, "summary")}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium">
                  Descubrir <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
