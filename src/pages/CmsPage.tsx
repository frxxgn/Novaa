import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useSite } from "@/app/site";
import { useI18n } from "@/i18n";
import { useSeo } from "@/hooks/useSeo";
import { fetchPublishedPage } from "@/services/content";
import { PageRenderer } from "@/features/cms/PageRenderer";
import { ErrorState } from "@/components/ui/feedback";
import NotFound from "./NotFound";

export default function CmsPage({ path }: { path?: string }) {
  const location = useLocation();
  const target = (path ?? location.pathname).replace(/\/+$/, "") || "/";
  const { settings } = useSite();
  const { locale } = useI18n();
  const q = useQuery({ queryKey: ["page", target], queryFn: () => fetchPublishedPage(target), staleTime: 60_000 });
  const page = q.data?.page;
  const i18n = page?.i18n?.[locale] ?? {};

  useSeo({
    title: target === "/" ? undefined : i18n.title || page?.seo?.title || page?.title,
    description: i18n.description || page?.seo?.description,
    image: page?.seo?.og_image,
    canonical: page?.seo?.canonical,
    noindex: page?.seo?.noindex,
    jsonLd:
      target === "/"
        ? {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: settings.company.name,
            url: settings.seo_defaults.site_url || window.location.origin,
            logo: `${settings.seo_defaults.site_url || window.location.origin}/brand/novalius-isotipo.svg`,
            email: settings.contact.email || undefined,
            description: settings.company.description,
          }
        : undefined,
  });

  if (q.isLoading) {
    return <div className="min-h-[100svh]" aria-busy="true" />;
  }
  if (q.error) {
    return (
      <div className="container-nv py-40">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    );
  }
  if (!page) return <NotFound />;
  return <PageRenderer sections={page.sections} />;
}
