import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { fetchTemplates } from "@/services/content";
import { Reveal } from "@/components/motion/Reveal";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { TemplatePreview } from "./TemplatePreview";

export default function TemplatesGallery() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["templates"], queryFn: fetchTemplates, staleTime: 120_000 });
  const [category, setCategory] = useState("Todas");
  const categories = useMemo(() => ["Todas", ...new Set((q.data ?? []).map((tpl) => tpl.category))], [q.data]);
  const list = (q.data ?? []).filter((tpl) => category === "Todas" || tpl.category === category);

  return (
    <div className="container-nv pb-[calc(var(--nv-section-space)*0.6)]">
      <div className="-mx-4 mb-10 flex gap-2 overflow-x-auto px-4 scrollbar-none" role="tablist" aria-label="Sectores">
        {categories.map((c) => (
          <button key={c} role="tab" aria-selected={category === c} onClick={() => setCategory(c)} className={cn("shrink-0 rounded-full border border-tone px-4 py-2 text-sm transition-colors", category === c ? "bg-white text-ink" : "hover:bg-white/5")}>
            {c}
          </button>
        ))}
      </div>
      {q.isLoading && (
        <div className="grid gap-8 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="aspect-[16/10]" />
          ))}
        </div>
      )}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      <ul className="grid gap-x-8 gap-y-14 md:grid-cols-2">
        {list.map((tpl, i) => (
          <Reveal as="li" key={tpl.id} delay={(i % 2) * 0.08}>
            <div className="group">
              <Link to={`/plantillas/${tpl.slug}`} className="block" data-cursor="card" data-cursor-label="Abrir" onClick={() => track("template_open", { slug: tpl.slug })}>
                <div className="relative overflow-hidden rounded-lg border border-tone shadow-[0_40px_80px_-50px_rgba(108,38,232,.6)] transition-transform duration-700 group-hover:-translate-y-1.5">
                  <TemplatePreview template={tpl} />
                  <div className="pointer-events-none absolute bottom-3 right-3 w-[22%] overflow-hidden rounded-[14px] border-4 border-[#111] shadow-2xl">
                    <TemplatePreview template={tpl} device="mobile" />
                  </div>
                </div>
              </Link>
              <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-lavender">{tpl.category}</p>
                  <h2 className="mt-1 font-display text-2xl tracking-tight">{tpl.name}</h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{tpl.description}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {tpl.features.map((f) => (
                      <li key={f} className="rounded-full border border-tone px-2.5 py-0.5 text-[11px] text-muted">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <Link to={`/demo/${tpl.slug}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full border border-tone px-4 py-2 text-sm hover:bg-white/5" onClick={() => track("template_open", { slug: tpl.slug, full: true })}>
                    {t("templates.open")} <ExternalLink className="size-3.5" />
                  </Link>
                  <Link to={`/contacto?plantilla=${tpl.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-white hover:opacity-90">
                    {t("templates.request")} <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
