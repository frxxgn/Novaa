import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { useI18n } from "@/i18n";
import type { ContactPrefill } from "./useNova";

export function ContactCard({ prefill, onSubmit, sent }: { prefill: ContactPrefill; sent: boolean; onSubmit: (d: { name: string; email: string; phone: string; company: string; message: string; consent: boolean; quote_id: string | null; whatsapp_opt_in: boolean }) => Promise<void> }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: prefill.name, email: prefill.email, phone: prefill.phone, company: prefill.company, message: prefill.summary });
  const [consent, setConsent] = useState(false);
  const [waOptIn, setWaOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-success/40 bg-success/10 p-4 text-sm text-white">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        {t("nova.contact_sent")}
      </div>
    );
  }

  const field = "w-full rounded-sm border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-lavender focus:outline-none";
  return (
    <form
      className="space-y-2.5 rounded-md border border-white/15 bg-white/[0.04] p-4 text-white"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!consent) {
          setError("Debes aceptar la política de privacidad para enviar tus datos.");
          return;
        }
        setLoading(true);
        try {
          await onSubmit({ ...form, consent, quote_id: prefill.quote_id, whatsapp_opt_in: waOptIn });
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setLoading(false);
        }
      }}
    >
      <p className="font-display text-sm">{t("nova.contact_title")}</p>
      <div className="grid grid-cols-2 gap-2">
        <input className={field} required maxLength={120} placeholder="Nombre*" aria-label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        <input className={field} placeholder="Empresa" aria-label="Empresa" maxLength={160} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoComplete="organization" />
      </div>
      <input className={field} required type="email" placeholder="Correo electrónico*" aria-label="Correo electrónico" maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
      <input className={field} type="tel" placeholder="Teléfono o WhatsApp (opcional)" aria-label="Teléfono" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
      <textarea className={field} rows={3} maxLength={2000} placeholder="Resumen del proyecto" aria-label="Resumen del proyecto" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      {form.phone && (
        <label className="flex items-start gap-2 text-xs text-white/70">
          <input type="checkbox" className="mt-0.5 accent-[var(--nv-primary)]" checked={waOptIn} onChange={(e) => setWaOptIn(e.target.checked)} />
          Acepto que me contactéis por WhatsApp.
        </label>
      )}
      <label className="flex items-start gap-2 text-xs text-white/70">
        <input type="checkbox" className="mt-0.5 accent-[var(--nv-primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-required="true" />
        <span>
          He leído y acepto la{" "}
          <Link to="/privacidad" className="underline" target="_blank">
            política de privacidad
          </Link>
          . Mis datos y esta conversación se enviarán al equipo de Novalius.
        </span>
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
        {loading ? "Enviando…" : t("nova.contact_send")}
      </button>
    </form>
  );
}
