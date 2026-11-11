import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSeo } from "@/hooks/useSeo";
import { cn } from "@/lib/utils";
import { fetchTemplate } from "@/services/content";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { DemoSite } from "@/features/templates/DemoSite";
import NotFound from "./NotFound";

export function TemplateDetailPage() {
  const { slug = "" } = useParams();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["template", slug], queryFn: () => fetchTemplate(slug) });
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const tpl = q.data;
  useSeo({ title: tpl ? `Plantilla ${tpl.name} · ${tpl.category}` : undefined, description: tpl?.description });

  if (q.isLoading) return <div className="container-nv py-40"><Skeleton className="h-[70vh]" /></div>;
  if (q.error) return <div className="container-nv py-40"><ErrorState error={q.error} /></div>;
  if (!tpl) return <NotFound />;

  const frameWidth = device === "desktop" ? "100%" : device === "tablet" ? "min(100%, 680px)" : "min(100%, 360px)";

  return (
    <section className="tone-dark pb-24 pt-28 md:pt-32">
      <div className="container-nv">
        <Link to="/plantillas" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white">
          <ArrowLeft className="size-4" /> Plantillas
        </Link>
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-lavender">{tpl.category}</p>
            <h1 className="display-md mt-3">Plantilla {tpl.name}</h1>
            <p className="mt-3 max-w-2xl text-muted">{tpl.description}</p>
            <p className="mt-2 text-xs text-warning">{t("templates.fictional")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full border border-tone p-1" role="radiogroup" aria-label={t("templates.devices")}>
              {(
                [
                  ["desktop", Monitor, t("templates.desktop")],
                  ["tablet", Tablet, t("templates.tablet")],
                  ["mobile", Smartphone, t("templates.mobile")],
                ] as const
              ).map(([key, I, label]) => (
                <button key={key} role="radio" aria-checked={device === key} onClick={() => setDevice(key)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", device === key ? "bg-white text-ink" : "text-muted hover:text-white")}>
                  <I className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <ButtonLink to={`/demo/${tpl.slug}`} variant="outline" size="sm" target="_blank" iconRight={<ExternalLink className="size-3.5" />}>
              {t("templates.open")}
            </ButtonLink>
            <ButtonLink to={`/contacto?plantilla=${tpl.slug}`} size="sm" iconRight={<ArrowUpRight className="size-4" />} trackId={`template_request_${tpl.slug}`}>
              {t("templates.request")}
            </ButtonLink>
          </div>
        </div>
        <div className="mt-10 flex justify-center">
          <div className={cn("w-full overflow-hidden border border-white/15 shadow-[0_50px_120px_-40px_var(--nv-primary)] transition-[max-width] duration-500", device === "mobile" ? "rounded-[34px] border-[10px] border-[#151515]" : device === "tablet" ? "rounded-[26px] border-[10px] border-[#151515]" : "rounded-lg")} style={{ maxWidth: frameWidth }}>
            <div className="h-[72vh] min-h-[520px]">
              <DemoSite template={tpl} key={device} />
            </div>
          </div>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-2">
          {tpl.features.map((f) => (
            <li key={f} className="rounded-full border border-tone px-4 py-1.5 text-sm text-muted">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function DemoPage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const q = useQuery({ queryKey: ["template", slug], queryFn: () => fetchTemplate(slug) });
  useSeo({ title: q.data ? `Demo ${q.data.name}` : "Demo", noindex: true });
  if (q.isLoading) return <div className="h-[100dvh] bg-[#111]" />;
  if (!q.data) return <NotFound />;
  return (
    <div className="flex h-[100dvh] flex-col">
      {!embed && (
        <div className="tone-dark flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-sm">
          <Link to={`/plantillas/${slug}`} className="inline-flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowLeft className="size-4" /> Novalius · Plantillas
          </Link>
          <Link to={`/contacto?plantilla=${slug}`} className="rounded-full bg-primary px-4 py-1.5 text-white">
            Quiero una web así
          </Link>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <DemoSite template={q.data} />
      </div>
    </div>
  );
}
