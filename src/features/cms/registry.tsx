import { lazy, Suspense, type ComponentType } from "react";
import type { SectionData } from "@/types/content";
import { Skeleton } from "@/components/ui/feedback";
import { CtaSection, FaqSection, FeaturesGridSection, HeroSection, MarqueeSection, MediaSection, PageHeaderSection, RichTextSection, SplitSection, StatementSection } from "./sections/basic";
import { ChallengeTeaserSection, NovaCtaSection, PortfolioTeaserSection, ProcessSection, ServicesShowcaseSection, TemplatesTeaserSection } from "./sections/showcase";

export interface SectionProps {
  props: Record<string, unknown>;
  style: SectionData["style"];
  section: SectionData;
}

const ServicesIndex = lazy(() => import("@/features/services/ServicesIndex"));
const PortfolioIndex = lazy(() => import("@/features/portfolio/PortfolioIndex"));
const TemplatesGallery = lazy(() => import("@/features/templates/TemplatesGallery"));
const ContactModule = lazy(() => import("@/features/contact/ContactModule"));
const ChallengeModule = lazy(() => import("@/features/games/ChallengeModule"));

const MODULES: Record<string, ComponentType> = {
  services_index: ServicesIndex,
  portfolio_index: PortfolioIndex,
  templates_index: TemplatesGallery,
  contact: ContactModule,
  challenge: ChallengeModule,
};

function ModuleSection({ props }: SectionProps) {
  const M = MODULES[String(props.module)];
  if (!M) return null;
  return (
    <Suspense
      fallback={
        <div className="container-nv py-16">
          <Skeleton className="h-96" />
        </div>
      }
    >
      <M />
    </Suspense>
  );
}

export const SECTION_COMPONENTS: Record<string, ComponentType<SectionProps>> = {
  hero: HeroSection,
  marquee: MarqueeSection,
  statement: StatementSection,
  services_showcase: ServicesShowcaseSection,
  process: ProcessSection,
  nova_cta: NovaCtaSection,
  templates_teaser: TemplatesTeaserSection,
  portfolio_teaser: PortfolioTeaserSection,
  challenge_teaser: ChallengeTeaserSection,
  features_grid: FeaturesGridSection,
  split: SplitSection,
  media: MediaSection,
  faq: FaqSection,
  cta: CtaSection,
  page_header: PageHeaderSection,
  rich_text: RichTextSection,
  module: ModuleSection,
};
