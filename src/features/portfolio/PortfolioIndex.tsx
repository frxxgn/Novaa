import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { fetchProjects } from "@/services/content";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ProjectCover } from "./ProjectCover";

export default function PortfolioIndex() {
  const { t, tr } = useI18n();
  const q = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, staleTime: 120_000 });
  const [filter, setFilter] = useState<"all" | "real" | "concept">("all");
  const list = useMemo(() => (q.data ?? []).filter((p) => filter === "all" || (filter === "concept" ? p.is_concept : !p.is_concept)), [q.data, filter]);

  return (
    <div className="container-nv pb-[calc(var(--nv-section-space)*0.6)]">
      <div className="mb-10 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar proyectos">
        {[
          ["all", "Todos"],
          ["real", "Proyectos propios"],
          ["concept", "Conceptos de laboratorio"],
        ].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key as typeof filter)} className={cn("rounded-full border border-tone px-4 py-2 text-sm transition-colors", filter === key ? "bg-white text-ink" : "hover:bg-white/5")}>
            {label}
          </button>
        ))}
      </div>
      {q.isLoading && <Skeleton className="h-96" />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {!q.isLoading && list.length === 0 && <EmptyState title="Todavía no hay proyectos publicados en esta categoría" />}
      <ul className="grid gap-x-6 gap-y-14 md:grid-cols-2">
        {list.map((p, i) => (
          <Reveal as="li" key={p.id} delay={(i % 2) * 0.08}>
            <Link to={`/proyectos/${p.slug}`} className="group block" data-cursor="card" data-cursor-label="Ver">
              <div className="aspect-[4/3] overflow-hidden rounded-lg border border-tone">
                <ProjectCover project={p} className="transition-transform duration-1000 group-hover:scale-[1.04]" />
              </div>
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <span className={cn("mb-2 inline-block rounded-full border px-2.5 py-0.5 text-[11px]", p.is_concept ? "border-warning/50 text-warning" : "border-success/50 text-success")}>{p.is_concept ? t("common.concept") : p.client_label}</span>
                  <h2 className="font-display text-2xl tracking-tight">{tr(p, "title")}</h2>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{tr(p, "summary")}</p>
                </div>
                <ArrowUpRight className="mt-8 size-5 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
