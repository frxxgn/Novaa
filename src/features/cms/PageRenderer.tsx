import { Component, type ReactNode } from "react";
import type { SectionData } from "@/types/content";
import { cn } from "@/lib/utils";
import { SECTION_COMPONENTS } from "./registry";
import { SCHEMA_BY_TYPE } from "./schema";

class SectionBoundary extends Component<{ children: ReactNode; type: string }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(e: unknown) {
    console.error(`[sección ${this.props.type}]`, e);
  }
  render() {
    // Una sección defectuosa nunca rompe la página entera
    return this.state.error ? null : this.props.children;
  }
}

export function SectionView({ section, highlighted }: { section: SectionData; highlighted?: boolean }) {
  const C = SECTION_COMPONENTS[section.type];
  if (!C) return null;
  const tone = section.style?.tone ?? SCHEMA_BY_TYPE[section.type]?.defaultTone ?? "dark";
  const spacing = section.style?.spacing ?? "normal";
  const anchor = String(section.style?.anchor || (section.props as { anchor?: string }).anchor || "") || undefined;
  return (
    <section
      id={anchor}
      data-section-id={section.id}
      data-section-type={section.type}
      className={cn(
        `tone-${tone}`,
        "relative scroll-mt-20",
        spacing === "compact" && "[--nv-section-space:72px]",
        spacing === "spacious" && "[--nv-section-space:190px]",
        highlighted && "outline outline-2 -outline-offset-2 outline-[var(--nv-secondary)]",
      )}
    >
      <SectionBoundary type={section.type}>
        <C props={section.props ?? {}} style={{ ...section.style, tone }} section={section} />
      </SectionBoundary>
    </section>
  );
}

export function PageRenderer({ sections, highlightId }: { sections: SectionData[]; highlightId?: string | null }) {
  return (
    <>
      {sections
        .filter((s) => s.is_visible !== false)
        .map((s) => (
          <SectionView key={s.id} section={s} highlighted={highlightId === s.id} />
        ))}
    </>
  );
}
