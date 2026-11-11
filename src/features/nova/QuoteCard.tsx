import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, BookmarkCheck, BookmarkPlus, ChevronDown, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/app/auth";
import { api, errorMessage } from "@/lib/api";
import { cn, money, whatsappLink } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { QuoteSummary } from "@/shared/pricing";
import { forgetQuoteToken, quoteTokens } from "./useNova";

export function QuoteCard({ quote, onProposal, whatsapp, compact }: { quote: QuoteSummary; onProposal?: () => void; whatsapp?: { number: string; message: string } | null; compact?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(!compact);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mainItems = quote.items.filter((i) => i.kind !== "maintenance");

  const save = async () => {
    const token = quote.claim_token ?? quoteTokens()[quote.id];
    if (!token) {
      setSaved(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/quotes/${quote.id}/claim`, { body: { token } });
      forgetQuoteToken(quote.id);
      setSaved(true);
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const waText = `${whatsapp?.message ?? ""}\n\nPresupuesto ${quote.reference}: ${quote.title} (${money(quote.total_min)} – ${money(quote.total_max)}).`.trim();

  return (
    <div className="overflow-hidden rounded-md border border-[color-mix(in_oklab,var(--nv-secondary)_35%,transparent)] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--nv-primary)_22%,transparent),color-mix(in_oklab,var(--nv-surface-dark)_80%,transparent))] text-white">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-lavender">{t("nova.quote_title")}</p>
          <span className="font-mono text-[10px] text-white/50">{quote.reference}</span>
        </div>
        <p className="mt-2 text-sm text-white/75">{quote.title}</p>
        <p className="mt-1 font-display text-[1.7rem] leading-tight tracking-tight">
          {money(quote.total_min, quote.currency)} <span className="text-white/40">–</span> {money(quote.total_max, quote.currency)}
        </p>
        {quote.monthly_max > 0 && (
          <p className="mt-1 text-sm text-white/70">
            + {t("nova.quote_monthly")}: {money(quote.monthly_min)} – {money(quote.monthly_max)}/mes
          </p>
        )}
        <p className="mt-1 text-xs text-white/50">{quote.vat_note}</p>
        {!quote.reviewed && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> {t("nova.quote_unreviewed")}
          </p>
        )}
      </div>

      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs font-medium text-white/80 hover:bg-white/5" aria-expanded={open}>
        {t("nova.quote_breakdown")}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-white/10 px-4 py-3 text-xs">
          <ul className="space-y-1.5">
            {mainItems.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span className="text-white/75">{i.label}</span>
                <span className="shrink-0 font-mono text-white/90">
                  {i.min === i.max ? money(i.max) : `${money(i.min)} – ${money(i.max)}`}
                </span>
              </li>
            ))}
          </ul>
          {quote.included.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-white/90">{t("nova.quote_included")}</p>
              <p className="text-white/65">{quote.included.join(" · ")}</p>
            </div>
          )}
          {quote.optional.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-white/90">{t("nova.quote_optional")}</p>
              <ul className="space-y-1 text-white/65">
                {quote.optional.map((o) => (
                  <li key={o.key}>
                    {o.label}: {money(o.min)} – {money(o.max)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {quote.factors.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-white/90">{t("nova.quote_factors")}</p>
              <ul className="list-disc space-y-0.5 pl-4 text-white/65">
                {quote.factors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {quote.assumptions.length > 0 && <p className="text-white/55">Supuestos: {quote.assumptions.join(" ")}</p>}
          {quote.references.length > 0 && (
            <div className="text-white/55">
              Referencias de mercado:{" "}
              {quote.references.map((r) => (
                <span key={r.source + r.retrieved_at}>
                  {r.source} ({r.retrieved_at}){r.url && <> · <a className="underline" href={r.url} target="_blank" rel="noopener noreferrer">fuente</a></>}.{" "}
                </span>
              ))}
            </div>
          )}
          <p className="leading-relaxed text-white/50">{quote.disclaimer}</p>
        </div>
      )}

      {onProposal !== undefined && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
          <button onClick={onProposal} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:bg-lavender">
            <Send className="size-3.5" /> {t("nova.quote_proposal")}
          </button>
          {user ? (
            <button onClick={save} disabled={saved || saving} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs hover:bg-white/10 disabled:opacity-70">
              {saved ? <BookmarkCheck className="size-3.5 text-success" /> : <BookmarkPlus className="size-3.5" />}
              {saved ? t("nova.quote_saved") : t("nova.quote_save")}
            </button>
          ) : (
            <Link to={`/registro?next=${encodeURIComponent("/cuenta/presupuestos")}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs hover:bg-white/10">
              <BookmarkPlus className="size-3.5" /> Crear cuenta y guardar
            </Link>
          )}
          {whatsapp && (
            <a href={whatsappLink(whatsapp.number, waText)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs hover:bg-white/10" title="Abre WhatsApp con el mensaje preparado; el envío lo haces tú.">
              <MessageCircle className="size-3.5" /> {t("nova.quote_whatsapp")}
            </a>
          )}
          {saveError && <p className="w-full text-xs text-danger">{saveError}</p>}
        </div>
      )}
    </div>
  );
}
