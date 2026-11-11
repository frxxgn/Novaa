import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Mail, MessageCircle, Send } from "lucide-react";
import { useSite } from "@/app/site";
import { useAuth } from "@/app/auth";
import { api, errorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";
import { whatsappLink } from "@/lib/utils";
import { PROJECT_TYPE_LABELS, PROJECT_TYPES } from "@/shared/pricing";
import { fetchTemplate } from "@/services/content";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Reveal } from "@/components/motion/Reveal";
import { NovaAvatar } from "@/components/brand/Logo";
import { openNova } from "@/features/nova/NovaWidget";
import { quoteTokens } from "@/features/nova/useNova";

export default function ContactModule() {
  const { settings } = useSite();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const templateSlug = params.get("plantilla");
  const intent = params.get("intent");
  const quoteId = params.get("presupuesto");
  const template = useQuery({ queryKey: ["template", templateSlug], queryFn: () => fetchTemplate(templateSlug!), enabled: Boolean(templateSlug) });
  const startedAt = useRef(Date.now());
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", project_type: "", message: "", budget_range: "", timeline: "" });
  const [consent, setConsent] = useState(false);
  const [waOptIn, setWaOptIn] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, email, phone, company")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setForm((f) => ({ ...f, name: f.name || data.full_name, email: f.email || data.email, phone: f.phone || data.phone, company: f.company || data.company }));
      });
  }, [user]);

  useEffect(() => {
    if (template.data) setForm((f) => ({ ...f, project_type: f.project_type || "web", message: f.message || `Me interesa una web similar a la plantilla «${template.data!.name}» (${template.data!.category}) para mi negocio.` }));
  }, [template.data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Debes aceptar la política de privacidad.");
      return;
    }
    setState("sending");
    try {
      await api("/leads", {
        body: {
          ...form,
          whatsapp_opt_in: waOptIn,
          consent: true,
          website: honeypot,
          started_at: startedAt.current,
          source: templateSlug ? "template" : "contact_form",
          source_detail: templateSlug ? `Plantilla ${templateSlug}` : intent === "propuesta" ? "Solicitud de propuesta" : "",
          ...(quoteId ? { quote_id: quoteId, quote_token: quoteTokens()[quoteId] } : {}),
        },
      });
      track("form_submit", { form: templateSlug ? "template" : "contact" });
      setState("sent");
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  };

  const wa = settings.contact.whatsapp;

  return (
    <div className="container-nv pb-[calc(var(--nv-section-space)*0.6)]">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-4">
          <Reveal>
            <button onClick={() => openNova()} className="glass group flex w-full items-center gap-4 rounded-lg p-6 text-left transition-transform hover:-translate-y-0.5" data-cursor="button">
              <NovaAvatar className="size-14 shrink-0" pulse />
              <div className="flex-1">
                <p className="font-display text-xl">Habla con Nova</p>
                <p className="mt-1 text-sm text-muted">Respuestas al instante y un presupuesto orientativo en minutos.</p>
              </div>
            </button>
          </Reveal>
          {settings.contact.email && (
            <Reveal delay={0.05}>
              <a href={`mailto:${settings.contact.email}`} className="glass flex items-center gap-4 rounded-lg p-6 transition-colors hover:bg-white/[0.08]">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-white/[0.08] text-lavender">
                  <Mail className="size-5" />
                </span>
                <div>
                  <p className="text-sm text-muted">Correo electrónico</p>
                  <p className="font-medium">{settings.contact.email}</p>
                </div>
              </a>
            </Reveal>
          )}
          {wa && (
            <Reveal delay={0.1}>
              <a href={whatsappLink(wa, settings.contact.whatsapp_message)} target="_blank" rel="noopener noreferrer" className="glass flex items-center gap-4 rounded-lg p-6 transition-colors hover:bg-white/[0.08]">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
                  <MessageCircle className="size-5" />
                </span>
                <div>
                  <p className="text-sm text-muted">WhatsApp</p>
                  <p className="font-medium">Abrir conversación</p>
                </div>
              </a>
            </Reveal>
          )}
          {settings.contact.phone && (
            <p className="px-2 text-sm text-muted">
              Teléfono: <a href={`tel:${settings.contact.phone}`} className="text-[var(--tone-fg)]">{settings.contact.phone}</a>
            </p>
          )}
          {settings.contact.hours && <p className="px-2 text-sm text-muted">Horario: {settings.contact.hours}</p>}
        </div>

        <Reveal>
          <div className="glass rounded-lg p-6 md:p-9">
            {state === "sent" ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <CheckCircle2 className="size-12 text-success" />
                <h2 className="font-display text-2xl">Solicitud recibida</h2>
                <p className="max-w-md text-muted">Gracias, {form.name.split(" ")[0]}. El equipo de Novalius revisará tu proyecto y te escribirá a {form.email}.</p>
                {!user && (
                  <p className="text-sm text-muted">
                    <Link to="/registro" className="text-lavender underline underline-offset-4">
                      Crea una cuenta
                    </Link>{" "}
                    para consultar tus presupuestos y proyectos.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-4" noValidate={false}>
                <h2 className="font-display text-2xl">{intent === "propuesta" || templateSlug ? "Solicita tu propuesta" : "Cuéntanos tu proyecto"}</h2>
                {template.data && <p className="text-sm text-lavender">Plantilla de referencia: {template.data.name} · {template.data.category}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Nombre" required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Input label="Empresa" maxLength={160} autoComplete="organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  <Input label="Correo electrónico" type="email" required maxLength={200} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Input label="Teléfono o WhatsApp" type="tel" maxLength={40} autoComplete="tel" hint="Opcional" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <Select label="Tipo de proyecto" value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} placeholder="Selecciona…" options={PROJECT_TYPES.map((p) => ({ value: p, label: PROJECT_TYPE_LABELS[p] }))} />
                  <Select
                    label="¿Cuándo quieres empezar?"
                    value={form.timeline}
                    onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                    placeholder="Selecciona…"
                    options={["Lo antes posible", "En 1–3 meses", "Más adelante"].map((v) => ({ value: v, label: v }))}
                  />
                </div>
                <Select
                  label="Presupuesto aproximado"
                  hint="Opcional"
                  value={form.budget_range}
                  onChange={(e) => setForm({ ...form, budget_range: e.target.value })}
                  placeholder="Prefiero no indicarlo"
                  options={["Menos de 2.000 €", "2.000–5.000 €", "5.000–10.000 €", "Más de 10.000 €"].map((v) => ({ value: v, label: v }))}
                />
                <Textarea label="¿Qué necesitas?" required rows={5} maxLength={6000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tu negocio, qué quieres conseguir, funcionalidades, referencias…" />
                {/* Campo trampa para bots: oculto para personas */}
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Web
                    <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </label>
                </div>
                {form.phone && <Checkbox checked={waOptIn} onChange={setWaOptIn} label="Acepto que me contactéis por WhatsApp." />}
                <Checkbox
                  checked={consent}
                  onChange={setConsent}
                  required
                  label={
                    <>
                      He leído y acepto la{" "}
                      <Link to="/privacidad" className="text-lavender underline underline-offset-4" target="_blank">
                        política de privacidad
                      </Link>
                      .
                    </>
                  }
                />
                {error && (
                  <p className="text-sm text-danger" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" loading={state === "sending"} iconRight={<Send className="size-4" />} className="mt-2 sm:justify-self-start" trackId="contact_submit">
                  Enviar solicitud
                </Button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
