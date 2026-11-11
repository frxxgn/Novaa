import { useI18n } from "@/i18n";
import { useSeo } from "@/hooks/useSeo";
import { ButtonLink } from "@/components/ui/Button";
import { NovaliusMark } from "@/components/brand/Logo";

export default function NotFound() {
  const { t } = useI18n();
  useSeo({ title: t("notfound.title"), noindex: true });
  return (
    <section className="tone-dark relative flex min-h-[100svh] items-center overflow-hidden">
      <div className="grid-lines absolute inset-0 opacity-50" aria-hidden />
      <div className="container-nv relative text-center">
        <NovaliusMark className="mx-auto size-20 animate-float" />
        <p className="mt-8 font-display text-[clamp(5rem,18vw,12rem)] leading-none tracking-tighter text-gradient">404</p>
        <h1 className="mt-4 font-display text-3xl">{t("notfound.title")}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t("notfound.text")}</p>
        <ButtonLink to="/" className="mt-8" magnetic>
          {t("notfound.home")}
        </ButtonLink>
      </div>
    </section>
  );
}
