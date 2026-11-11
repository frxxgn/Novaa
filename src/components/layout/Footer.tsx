import { Link } from "react-router";
import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";
import { useI18n } from "@/i18n";
import { safeHref, whatsappLink } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { Reveal, SplitWords } from "@/components/motion/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", x: "X", youtube: "YouTube", tiktok: "TikTok", github: "GitHub" };

export function Footer() {
  const { nav, settings } = useSite();
  const { reopenConsent } = usePrefs();
  const { t, tr } = useI18n();
  // Columnas ordenadas por la posición mínima de sus enlaces (configurable en el panel)
  const groups = new Map<string, typeof nav>();
  for (const item of [...nav.filter((n) => n.menu === "footer")].sort((a, b) => a.position - b.position)) {
    const g = item.group_label || "Novalius";
    groups.set(g, [...(groups.get(g) ?? []), item]);
  }
  const legal = nav.filter((n) => n.menu === "legal");
  const socials = Object.entries(settings.social ?? {}).filter(([, url]) => typeof url === "string" && /^https?:\/\//.test(url));
  const year = new Date().getFullYear();
  const email = settings.contact.email;

  return (
    <footer className="tone-dark noise relative overflow-hidden border-t border-white/10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[80%] -translate-x-1/2 rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--nv-primary) 60%, transparent), transparent)" }} />
      <div className="container-nv relative pb-10 pt-24 md:pt-32">
        <div className="flex flex-col gap-10 border-b border-white/10 pb-16 md:flex-row md:items-end md:justify-between">
          <h2 className="display-lg max-w-3xl">
            <SplitWords text="¿Construimos lo siguiente juntos?" highlight="juntos?" />
          </h2>
          <div className="flex flex-col items-start gap-3">
            {email && (
              <Magnetic>
                <a href={`mailto:${email}`} className="group inline-flex items-center gap-3 rounded-full border border-white/15 px-6 py-4 text-lg transition-colors hover:border-lavender hover:bg-white/5" data-cursor="button">
                  <Mail className="size-5 text-lavender" />
                  {email}
                  <ArrowUpRight className="size-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </Magnetic>
            )}
            {settings.contact.whatsapp && (
              <a href={whatsappLink(settings.contact.whatsapp, settings.contact.whatsapp_message)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-12 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <Reveal>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">{settings.company.description || settings.company.tagline}</p>
            {socials.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {socials.map(([k, url]) => (
                  <li key={k}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-lavender hover:text-white">
                      {SOCIAL_LABELS[k] ?? k}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
          {[...groups.entries()].map(([group, items], i) => (
            <Reveal key={group} delay={0.05 * (i + 1)}>
              <p className="eyebrow text-lavender">{group}</p>
              <ul className="mt-5 space-y-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link to={safeHref(item.href)} className="text-sm text-white/70 transition-colors hover:text-white" data-cursor="link">
                      {tr(item, "label")}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {settings.company.legal_name || settings.company.name}. {t("footer.rights")}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legal.map((item) => (
              <Link key={item.id} to={safeHref(item.href)} className="hover:text-white">
                {tr(item, "label")}
              </Link>
            ))}
            <button className="hover:text-white" onClick={reopenConsent}>
              {t("footer.privacy_prefs")}
            </button>
          </div>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none select-none overflow-hidden">
        <p className="translate-y-[18%] whitespace-nowrap text-center font-display text-[22vw] font-bold leading-none tracking-[-0.06em] text-white/[0.035]">novalius</p>
      </div>
    </footer>
  );
}
