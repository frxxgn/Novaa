import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Globe, LayoutDashboard, Menu, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { useSite } from "@/app/site";
import { useAuth } from "@/app/auth";
import { usePrefs } from "@/app/prefs";
import { useI18n } from "@/i18n";
import { fetchServices } from "@/services/content";
import { cn, safeHref } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function Header() {
  const { nav, settings } = useSite();
  const { user, isStaff } = useAuth();
  const { sound, toggleSound, playTick, motionEnabled } = usePrefs();
  const { t, locale, locales, setLocale, tr } = useI18n();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const services = useQuery({ queryKey: ["services"], queryFn: fetchServices, staleTime: 120_000 });

  const items = nav.filter((n) => n.menu === "header" && !n.is_cta);
  const cta = nav.find((n) => n.menu === "header" && n.is_cta);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 420 && y > last + 4 && !open);
      if (y < last - 4) setHidden(false);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setMega(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <a href="#contenido" className="sr-only z-[500] rounded-md bg-white px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        {t("nav.skip")}
      </a>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[100] transition-[transform,background,border-color,backdrop-filter] duration-500",
          hidden && !mega ? "-translate-y-full" : "translate-y-0",
          scrolled || mega ? "border-b border-white/10 bg-[color-mix(in_oklab,var(--nv-bg-dark)_72%,transparent)] backdrop-blur-xl" : "border-b border-transparent",
        )}
        onMouseLeave={() => setMega(false)}
      >
        <div className="container-nv flex h-[72px] items-center justify-between gap-6 text-on-dark">
          <Logo />
          <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
            {items.map((item) => {
              const isServices = item.href === "/servicios";
              return (
                <NavLink
                  key={item.id}
                  to={safeHref(item.href)}
                  onMouseEnter={() => {
                    setMega(isServices);
                    playTick("hover");
                  }}
                  onFocus={() => setMega(isServices)}
                  className={({ isActive }) => cn("group relative rounded-full px-3.5 py-2 text-[0.92rem] text-white/75 transition-colors hover:text-white", isActive && "text-white")}
                  data-cursor="link"
                >
                  {({ isActive }) => (
                    <>
                      {tr(item, "label")}
                      <span className={cn("absolute inset-x-3.5 bottom-1 h-px origin-left scale-x-0 bg-gradient-to-r from-lavender to-secondary transition-transform duration-500 group-hover:scale-x-100", isActive && "scale-x-100")} />
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <div className="flex items-center gap-1.5">
            {locales.length > 1 && (
              <button
                className="hidden size-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white sm:inline-flex"
                onClick={() => setLocale(locales[(locales.indexOf(locale) + 1) % locales.length]!)}
                aria-label={`${t("nav.language")}: ${locale.toUpperCase()}`}
                title={t("nav.language")}
              >
                <Globe className="size-[18px]" />
                <span className="sr-only">{locale}</span>
              </button>
            )}
            <button
              className="hidden size-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white sm:inline-flex"
              onClick={() => {
                toggleSound();
              }}
              aria-pressed={sound}
              aria-label={sound ? t("nav.sound_off") : t("nav.sound_on")}
              title={sound ? t("nav.sound_off") : t("nav.sound_on")}
            >
              {sound ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
            </button>
            {isStaff && (
              <Link to="/admin" className="hidden size-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white sm:inline-flex" aria-label={t("nav.admin")} title={t("nav.admin")}>
                <LayoutDashboard className="size-[18px]" />
              </Link>
            )}
            <Link to={user ? "/cuenta" : "/login"} className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex" data-cursor="link">
              <UserRound className="size-[18px]" />
              <span className="hidden xl:inline">{user ? t("nav.account") : t("nav.login")}</span>
            </Link>
            {cta && (
              <span className="ml-1 hidden md:inline-flex">
                <ButtonLink to={cta.href} size="sm" magnetic iconRight={<ArrowUpRight className="size-4" />} trackId="header_cta">
                  {tr(cta, "label")}
                </ButtonLink>
              </span>
            )}
            <button className="inline-flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10 lg:hidden" onClick={() => setOpen(true)} aria-label={t("nav.menu")} aria-expanded={open}>
              <Menu className="size-6" />
            </button>
          </div>
        </div>

        {/* Mega menú de servicios */}
        <AnimatePresence>
          {mega && (services.data?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: motionEnabled ? 0.25 : 0 }}
              className="absolute inset-x-0 top-full hidden border-b border-white/10 bg-[color-mix(in_oklab,var(--nv-bg-dark)_90%,transparent)] backdrop-blur-xl lg:block"
            >
              <div className="container-nv grid grid-cols-[1.1fr_3fr] gap-10 py-8 text-on-dark">
                <div>
                  <p className="eyebrow text-lavender">Servicios</p>
                  <p className="mt-3 font-display text-2xl leading-tight">{settings.company.tagline}</p>
                  <Link to="/servicios" className="mt-5 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
                    {t("services.all")} <ArrowUpRight className="size-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {services.data!.map((s) => (
                    <Link key={s.id} to={`/servicios/${s.slug}`} className="group flex items-start gap-3 rounded-sm p-3 transition-colors hover:bg-white/[0.06]" data-cursor="link">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-lavender transition-colors group-hover:bg-primary group-hover:text-white">
                        <Icon name={s.icon} className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{tr(s, "title")}</span>
                        <span className="mt-0.5 line-clamp-1 block text-xs text-white/55">{tr(s, "tagline")}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { nav, settings } = useSite();
  const { user, isStaff } = useAuth();
  const { sound, toggleSound } = usePrefs();
  const { t, tr, locales, locale, setLocale } = useI18n();
  const items = nav.filter((n) => n.menu === "header" && !n.is_cta);
  const cta = nav.find((n) => n.menu === "header" && n.is_cta);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.menu")}
          className="tone-dark fixed inset-0 z-[150] flex flex-col overflow-y-auto lg:hidden"
          initial={{ clipPath: "circle(0% at 92% 4%)" }}
          animate={{ clipPath: "circle(150% at 92% 4%)" }}
          exit={{ clipPath: "circle(0% at 92% 4%)" }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 50% at 100% 0%, color-mix(in oklab, var(--nv-primary) 45%, transparent), transparent 70%)" }} />
          <div className="container-nv relative flex h-[72px] items-center justify-between">
            <Logo />
            <button className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10" onClick={onClose} aria-label={t("nav.close")}>
              <X className="size-6" />
            </button>
          </div>
          <nav className="container-nv relative mt-6 flex flex-col" aria-label="Móvil">
            {items.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                <Link to={safeHref(item.href)} className="flex items-center justify-between border-b border-white/10 py-4 font-display text-[2rem] leading-none tracking-tight" onClick={onClose}>
                  {tr(item, "label")}
                  <ArrowUpRight className="size-6 text-white/40" />
                </Link>
              </motion.div>
            ))}
          </nav>
          <div className="container-nv relative mt-auto flex flex-col gap-3 pb-[max(24px,env(safe-area-inset-bottom))] pt-10">
            {cta && (
              <ButtonLink to={cta.href} size="lg" className="w-full" onClick={onClose} trackId="mobile_cta">
                {tr(cta, "label")}
              </ButtonLink>
            )}
            <div className="grid grid-cols-2 gap-3">
              <ButtonLink to={user ? "/cuenta" : "/login"} variant="outline" className="w-full" onClick={onClose} icon={<UserRound className="size-4" />}>
                {user ? t("nav.account") : t("nav.login")}
              </ButtonLink>
              {isStaff ? (
                <ButtonLink to="/admin" variant="outline" className="w-full" onClick={onClose} icon={<LayoutDashboard className="size-4" />}>
                  {t("nav.admin")}
                </ButtonLink>
              ) : (
                <button onClick={toggleSound} className="inline-flex h-11 items-center justify-center gap-2 rounded-btn border border-tone text-sm" aria-pressed={sound}>
                  {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                  {sound ? t("nav.sound_off") : t("nav.sound_on")}
                </button>
              )}
            </div>
            {locales.length > 1 && (
              <div className="flex gap-2">
                {locales.map((l) => (
                  <button key={l} onClick={() => setLocale(l)} className={cn("rounded-full border border-tone px-3 py-1 text-xs uppercase", l === locale && "bg-white text-ink")}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {settings.contact.email && (
              <a href={`mailto:${settings.contact.email}`} className="mt-2 text-sm text-white/60">
                {settings.contact.email}
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
