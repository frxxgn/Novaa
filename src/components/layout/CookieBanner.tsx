import { useEffect } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";
import { useI18n } from "@/i18n";
import { setAnalyticsEnabled } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";

export function CookieBanner() {
  const { settings } = useSite();
  const { consent, setConsent, consentOpen } = usePrefs();
  const { t } = useI18n();
  const visible = consent === null || consentOpen;

  useEffect(() => {
    setAnalyticsEnabled(Boolean(consent?.analytics) && settings.analytics.enabled !== false);
  }, [consent, settings.analytics.enabled]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-labelledby="nv-cookie-title"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", damping: 26, stiffness: 260, delay: consentOpen ? 0 : 1.2 }}
          className="tone-dark fixed inset-x-3 bottom-3 z-[250] rounded-md border border-white/12 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-md sm:rounded-lg sm:p-5"
          style={{ background: "color-mix(in oklab, var(--nv-surface-dark) 92%, transparent)" }}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-lavender" />
            <div>
              <p id="nv-cookie-title" className="font-display text-base">
                {settings.cookies.banner_title}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/65 sm:mt-1.5 sm:text-sm">{settings.cookies.banner_text}</p>
              <Link to="/cookies" className="mt-2 inline-block text-xs text-lavender underline underline-offset-4">
                {t("cookies.more")}
              </Link>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setConsent(false)}>
              {t("cookies.reject")}
            </Button>
            <Button size="sm" onClick={() => setConsent(true)}>
              {t("cookies.accept")}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
