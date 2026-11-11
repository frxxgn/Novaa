// Demo funcional de una web sectorial. Usa container queries (@container) para
// que su diseño responda al ancho del contenedor: así funciona igual a pantalla
// completa que dentro de una previsualización de dispositivo.
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Briefcase, Calendar, Car, CheckCircle2, Clock, HardHat, MapPin, Phone, Scale, Scissors, ShoppingBag, Sparkles, Stethoscope, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { Template } from "@/types/content";

const ICON_BY_DEMO: Record<string, LucideIcon> = {
  restaurant: UtensilsCrossed,
  barber: Scissors,
  clinic: Stethoscope,
  construction: HardHat,
  garage: Car,
  shop: ShoppingBag,
  law: Scale,
  services: Briefcase,
  freelancer: Sparkles,
};

const FONTS: Record<string, string> = {
  serif: '"Fraunces Variable", Georgia, serif',
  sans: '"Inter Variable", system-ui, sans-serif',
  condensed: '"Oswald Variable", "Arial Narrow", sans-serif',
  display: '"Space Grotesk Variable", "Sora Variable", sans-serif',
};

function luminance(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
}

export function DemoSite({ template, scrollable = true }: { template: Template; scrollable?: boolean }) {
  const { theme, content: c, demo_key } = template;
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  const [cart, setCart] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [plate, setPlate] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const Icon = ICON_BY_DEMO[demo_key] ?? Sparkles;
  const dark = luminance(theme.bg) < 128;
  const onPrimary = luminance(theme.primary) > 150 ? "#111" : "#fff";
  const muted = dark ? "rgba(255,255,255,.66)" : "rgba(0,0,0,.6)";
  const line = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)";
  const heading = FONTS[theme.font] ?? FONTS.sans;
  const vars = { "--d-primary": theme.primary, "--d-accent": theme.accent, "--d-bg": theme.bg, "--d-surface": theme.surface, "--d-text": theme.text, "--d-muted": muted, "--d-line": line } as CSSProperties;
  const categories = c.categories ?? [];
  const current = categories[Math.min(tab, categories.length - 1)];
  const isShop = demo_key === "shop";

  const go = (id: string) => {
    const root = rootRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-demo-section="${id}"]`);
    if (root && el) root.scrollTo({ top: el.offsetTop - 64, behavior: "smooth" });
  };

  const art = useMemo(
    () => ({
      background: `radial-gradient(80% 70% at 75% 25%, color-mix(in oklab, ${theme.primary} 85%, transparent), transparent 65%), radial-gradient(60% 60% at 15% 90%, color-mix(in oklab, ${theme.accent} 55%, transparent), transparent 70%), ${theme.surface}`,
    }),
    [theme],
  );

  return (
    <div ref={rootRef} className={`@container size-full ${scrollable ? "overflow-y-auto" : "overflow-hidden"}`} style={{ ...vars, background: theme.bg, color: theme.text, fontFamily: FONTS.sans }} data-lenis-prevent>
      {/* Cabecera */}
      <header className="sticky top-0 z-10 border-b backdrop-blur" style={{ borderColor: line, background: `color-mix(in oklab, ${theme.bg} 85%, transparent)` }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <button onClick={() => go("top")} className="flex items-center gap-2 text-lg font-semibold" style={{ fontFamily: heading }}>
            <Icon className="size-5" style={{ color: theme.primary }} />
            {c.brand}
          </button>
          <nav className="hidden items-center gap-6 text-sm @3xl:flex" style={{ color: muted }}>
            {c.nav.map((n, i) => (
              <button key={n} onClick={() => go(["offer", "features", "booking", "contact"][i] ?? "contact")} className="hover:opacity-100">
                {n}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isShop && (
              <span className="relative inline-flex size-9 items-center justify-center rounded-full border" style={{ borderColor: line }} aria-label={`Carrito: ${cart.length}`}>
                <ShoppingBag className="size-4" />
                {cart.length > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px]" style={{ background: theme.primary, color: onPrimary }}>{cart.length}</span>}
              </span>
            )}
            <button onClick={() => go("booking")} className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: theme.primary, color: onPrimary }}>
              {c.hero.cta}
            </button>
          </div>
        </div>
        <p className="py-1 text-center text-[11px] tracking-wide" style={{ background: `color-mix(in oklab, ${theme.primary} 15%, transparent)`, color: muted }}>
          Demostración de Novalius · {c.brand} es un negocio ficticio
        </p>
      </header>

      {/* Hero */}
      <section data-demo-section="top" className={`mx-auto grid max-w-6xl gap-8 px-5 py-14 @3xl:py-20 ${theme.layout === "centered" ? "text-center" : "@3xl:grid-cols-[1.15fr_1fr] @3xl:items-center"}`}>
        <div className={theme.layout === "centered" ? "mx-auto max-w-3xl" : ""}>
          <p className="text-xs uppercase tracking-[0.25em]" style={{ color: theme.primary }}>
            {c.tagline}
          </p>
          <h1 className="mt-4 text-4xl leading-[1.02] tracking-tight @3xl:text-6xl" style={{ fontFamily: heading, fontWeight: theme.font === "serif" ? 500 : 700 }}>
            {c.hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed @3xl:text-lg" style={{ color: muted, marginInline: theme.layout === "centered" ? "auto" : undefined }}>
            {c.hero.subtitle}
          </p>
          <div className={`mt-8 flex flex-wrap gap-3 ${theme.layout === "centered" ? "justify-center" : ""}`}>
            <button onClick={() => go("booking")} className="rounded-full px-6 py-3 text-sm font-semibold" style={{ background: theme.primary, color: onPrimary }}>
              {c.hero.cta}
            </button>
            <button onClick={() => go("offer")} className="rounded-full border px-6 py-3 text-sm" style={{ borderColor: line }}>
              {c.offer_title}
            </button>
          </div>
        </div>
        {theme.layout !== "centered" && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl" style={art} aria-hidden>
            <Icon className="absolute bottom-6 right-6 size-24 opacity-30" style={{ color: theme.text }} />
            <div className="absolute left-6 top-6 rounded-2xl px-4 py-3 text-sm backdrop-blur" style={{ background: `color-mix(in oklab, ${theme.bg} 70%, transparent)` }}>
              <p className="font-semibold" style={{ fontFamily: heading }}>
                {c.features[0]?.title}
              </p>
              <p className="text-xs" style={{ color: muted }}>
                {c.hours[0]}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Puntos fuertes */}
      <section data-demo-section="features" className="mx-auto grid max-w-6xl gap-4 px-5 pb-14 @2xl:grid-cols-3">
        {c.features.map((f) => (
          <div key={f.title} className="rounded-2xl border p-6" style={{ borderColor: line, background: theme.surface }}>
            <CheckCircle2 className="size-5" style={{ color: theme.primary }} />
            <h3 className="mt-4 text-lg font-semibold" style={{ fontFamily: heading }}>
              {f.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: muted }}>
              {f.text}
            </p>
          </div>
        ))}
      </section>

      {/* Oferta: carta / servicios / catálogo */}
      <section data-demo-section="offer" className="border-y py-14" style={{ borderColor: line, background: theme.surface }}>
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl tracking-tight @3xl:text-4xl" style={{ fontFamily: heading }}>
            {c.offer_title}
          </h2>
          {categories.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2" role="tablist">
              {categories.map((cat, i) => (
                <button key={cat.name} role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className="rounded-full border px-4 py-1.5 text-sm" style={{ borderColor: tab === i ? theme.primary : line, background: tab === i ? theme.primary : "transparent", color: tab === i ? onPrimary : theme.text }}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}
          <ul className="mt-8 grid gap-3 @2xl:grid-cols-2">
            {current?.items.map((item) => (
              <li key={item.name} className="flex items-start justify-between gap-4 rounded-2xl border p-5" style={{ borderColor: line, background: theme.bg }}>
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm" style={{ color: muted }}>
                    {item.description}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {item.price && (
                    <span className="font-semibold" style={{ color: theme.primary }}>
                      {item.price}
                    </span>
                  )}
                  {isShop && (
                    <button onClick={() => setCart((s) => [...s, item.name])} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: theme.primary, color: onPrimary }}>
                      Añadir
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {isShop && cart.length > 0 && (
            <p className="mt-4 text-sm" style={{ color: muted }}>
              Carrito de demostración: {cart.join(", ")}.{" "}
              <button className="underline" onClick={() => setCart([])}>
                Vaciar
              </button>
            </p>
          )}
        </div>
      </section>

      {/* Bloques específicos del sector */}
      {c.status_demo && (
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl tracking-tight" style={{ fontFamily: heading }}>
            Consulta el estado de tu vehículo
          </h2>
          <form
            className="mt-5 flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setShowStatus(true);
            }}
          >
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder={c.status_demo.plate} aria-label="Matrícula" className="flex-1 rounded-full border bg-transparent px-4 py-2.5 text-sm" style={{ borderColor: line }} />
            <button className="rounded-full px-5 text-sm font-medium" style={{ background: theme.primary, color: onPrimary }}>
              Consultar
            </button>
          </form>
          {showStatus && (
            <ol className="mt-6 grid gap-2 @2xl:grid-cols-4">
              {c.status_demo.steps.map((s, i) => (
                <li key={s} className="rounded-xl border p-4 text-sm" style={{ borderColor: i <= c.status_demo!.current ? theme.primary : line, opacity: i <= c.status_demo!.current ? 1 : 0.5 }}>
                  <span className="text-xs" style={{ color: theme.primary }}>
                    Paso {i + 1}
                  </span>
                  <p className="mt-1 font-medium">{s}</p>
                </li>
              ))}
            </ol>
          )}
          {showStatus && (
            <p className="mt-3 text-xs" style={{ color: muted }}>
              Datos de ejemplo: en una web real se conectaría con el panel del taller.
            </p>
          )}
        </section>
      )}
      {c.faq && c.faq.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl tracking-tight" style={{ fontFamily: heading }}>
            Preguntas frecuentes
          </h2>
          <ul className="mt-5 divide-y border-y" style={{ borderColor: line }}>
            {c.faq.map((f, i) => (
              <li key={f.q} style={{ borderColor: line }}>
                <button className="w-full py-4 text-left font-medium" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  {f.q}
                </button>
                {openFaq === i && (
                  <p className="pb-4 text-sm" style={{ color: muted }}>
                    {f.a}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reserva / cita / presupuesto */}
      <section data-demo-section="booking" className="mx-auto grid max-w-6xl gap-8 px-5 py-14 @3xl:grid-cols-2">
        <div>
          <h2 className="text-3xl tracking-tight @3xl:text-4xl" style={{ fontFamily: heading }}>
            {c.booking.title}
          </h2>
          <ul className="mt-6 space-y-2 text-sm" style={{ color: muted }}>
            {c.hours.map((h) => (
              <li key={h} className="flex items-center gap-2">
                <Clock className="size-4" style={{ color: theme.primary }} /> {h}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border p-6" style={{ borderColor: line, background: theme.surface }}>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="size-10" style={{ color: theme.primary }} />
              <p className="text-lg font-semibold" style={{ fontFamily: heading }}>
                ¡Listo! Así funcionaría la confirmación.
              </p>
              <p className="max-w-xs text-sm" style={{ color: muted }}>
                Esto es una demostración: no se ha enviado ni guardado ningún dato.
              </p>
              <button className="mt-2 text-sm underline" onClick={() => setSent(false)}>
                Volver a probar
              </button>
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              {c.booking.kind === "table" && (
                <div className="grid grid-cols-3 gap-2">
                  <DemoInput label="Fecha" type="date" line={line} />
                  <DemoInput label="Hora" type="time" line={line} />
                  <DemoInput label="Personas" type="number" min={1} max={20} defaultValue={2} line={line} />
                </div>
              )}
              {(c.booking.kind === "appointment" || c.booking.kind === "quote" || (c.booking.options && c.booking.options.length > 0)) && (
                <label className="grid gap-1 text-xs" style={{ color: muted }}>
                  {c.booking.kind === "quote" ? "Tipo de trabajo" : "Servicio"}
                  <select className="rounded-xl border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: line, color: theme.text }}>
                    {(c.booking.options ?? []).map((o) => (
                      <option key={o} style={{ color: "#111" }}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {c.booking.kind === "appointment" && (
                <div className="grid grid-cols-2 gap-2">
                  <DemoInput label="Fecha" type="date" line={line} />
                  <DemoInput label="Hora" type="time" line={line} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <DemoInput label="Nombre" required line={line} />
                <DemoInput label="Teléfono" type="tel" line={line} />
              </div>
              {(c.booking.kind === "quote" || c.booking.kind === "contact") && (
                <label className="grid gap-1 text-xs" style={{ color: muted }}>
                  Mensaje
                  <textarea rows={3} className="rounded-xl border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: line, color: theme.text }} />
                </label>
              )}
              <button className="mt-1 rounded-full py-3 text-sm font-semibold" style={{ background: theme.primary, color: onPrimary }}>
                {c.booking.cta}
              </button>
              <p className="text-center text-[11px]" style={{ color: muted }}>
                Formulario de demostración: no envía datos.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Contacto */}
      <footer data-demo-section="contact" className="border-t" style={{ borderColor: line, background: theme.surface }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm @2xl:flex-row @2xl:items-center @2xl:justify-between" style={{ color: muted }}>
          <p className="flex items-center gap-2 font-semibold" style={{ color: theme.text, fontFamily: heading }}>
            <Icon className="size-4" style={{ color: theme.primary }} /> {c.brand}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-4" /> {c.contact.address}
          </p>
          {c.contact.phone && (
            <p className="flex items-center gap-2">
              <Phone className="size-4" /> {c.contact.phone}
            </p>
          )}
          <p className="flex items-center gap-2">
            <Calendar className="size-4" /> Demo de Novalius
          </p>
        </div>
      </footer>
    </div>
  );
}

function DemoInput({ label, line, ...rest }: { label: string; line: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1 text-xs" style={{ color: "var(--d-muted)" }}>
      {label}
      <input className="min-w-0 rounded-xl border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: line, color: "var(--d-text)", colorScheme: "light dark" }} {...rest} />
    </label>
  );
}
