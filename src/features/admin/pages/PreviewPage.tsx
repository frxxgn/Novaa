// Previsualización del panel (dentro de un iframe del mismo origen):
//   /__preview/page/:id → borrador de una página (secciones recibidas en vivo)
//   /__preview/design   → inicio con tokens y animaciones aún sin publicar
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { applyDesign, normalizeAnimations, normalizeTokens } from "@/lib/design";
import { fetchPublishedPage } from "@/services/content";
import type { AnimationSettings, DesignTokens, SectionData } from "@/types/content";
import { SiteOverride } from "@/app/site";
import { PageRenderer } from "@/features/cms/PageRenderer";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function PreviewPage() {
  const { pathname } = useLocation();
  const pageId = /^\/__preview\/page\/([0-9a-f-]{36})/.exec(pathname)?.[1] ?? null;
  const isDesign = pathname.startsWith("/__preview/design");
  const [sections, setSections] = useState<SectionData[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tokens, setTokens] = useState<DesignTokens | undefined>();
  const [animations, setAnimations] = useState<AnimationSettings | undefined>();

  const draft = useQuery({
    queryKey: ["preview-draft", pageId],
    queryFn: async () => ((await supabase.from("page_sections").select("id, type, label, props, style, is_visible").eq("page_id", pageId!).order("position")).data ?? []) as SectionData[],
    enabled: Boolean(pageId),
  });
  const home = useQuery({ queryKey: ["page", "/"], queryFn: () => fetchPublishedPage("/"), enabled: isDesign });

  useEffect(() => {
    document.documentElement.classList.remove("nv-cursor");
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; sections?: SectionData[]; selected?: string | null; tokens?: DesignTokens; animations?: AnimationSettings };
      if (d.type === "nv-preview-sections" && Array.isArray(d.sections)) {
        setSections(d.sections);
        setSelected(d.selected ?? null);
      }
      if (d.type === "nv-preview-design") {
        const t = normalizeTokens(d.tokens);
        const a = normalizeAnimations(d.animations);
        document.documentElement.dataset.designLocked = "1";
        applyDesign(t, a);
        setTokens(t);
        setAnimations(a);
      }
    };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type: "nv-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Clic en una sección → seleccionarla en el editor (sin navegar)
  useEffect(() => {
    if (!pageId) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-section-id]");
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        window.parent?.postMessage({ type: "nv-select", id: el.dataset.sectionId }, window.location.origin);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pageId]);

  useEffect(() => {
    if (!selected) return;
    document.querySelector(`[data-section-id="${selected}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  const list = pageId ? (sections ?? draft.data ?? []) : (home.data?.page.sections ?? []);

  return (
    <SiteOverride tokens={tokens} animations={animations}>
      <div className="tone-dark min-h-[100dvh]">
        <Header />
        <main>
          <PageRenderer sections={list} highlightId={selected} />
        </main>
        {isDesign && <Footer />}
      </div>
    </SiteOverride>
  );
}
