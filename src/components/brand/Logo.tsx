// Identidad de Novalius: isotipo (anillo + «N» de cinta plegada que se
// convierte en una flecha ascendente) y logotipo tipográfico «novalius».
// Basado en el lenguaje del logotipo de referencia: anillo, pliegues de cinta,
// degradado azul tinta → violeta y flecha plateada de crecimiento.
import { useId } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { useSite } from "@/app/site";

export function NovaliusMark({ className, mono, onDark = true, title = "Novalius" }: { className?: string; mono?: boolean; onDark?: boolean; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`ring-${id}`} x1="10" y1="90" x2="90" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mono ? "currentColor" : onDark ? "color-mix(in oklab, var(--nv-indigo) 70%, #2f6fe4)" : "var(--nv-navy, #07195e)"} />
          <stop offset="0.55" stopColor={mono ? "currentColor" : onDark ? "color-mix(in oklab, var(--nv-primary) 60%, var(--nv-indigo))" : "var(--nv-indigo, #301e9f)"} />
          <stop offset="1" stopColor={mono ? "currentColor" : "var(--nv-secondary, #a540fb)"} />
        </linearGradient>
        <linearGradient id={`stem-${id}`} x1="30" y1="76" x2="40" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mono ? "currentColor" : onDark ? "var(--nv-indigo, #301e9f)" : "var(--nv-navy, #07195e)"} />
          <stop offset="1" stopColor={mono ? "currentColor" : onDark ? "color-mix(in oklab, var(--nv-primary) 70%, var(--nv-indigo))" : "var(--nv-indigo, #301e9f)"} />
        </linearGradient>
        <linearGradient id={`diag-${id}`} x1="34" y1="28" x2="64" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mono ? "currentColor" : "var(--nv-primary, #6c26e8)"} />
          <stop offset="1" stopColor={mono ? "currentColor" : "var(--nv-indigo, #301e9f)"} />
        </linearGradient>
        <linearGradient id={`rise-${id}`} x1="58" y1="74" x2="76" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mono ? "currentColor" : "var(--nv-primary, #6c26e8)"} />
          <stop offset="1" stopColor={mono ? "currentColor" : "var(--nv-secondary, #a540fb)"} />
        </linearGradient>
        <linearGradient id={`arrow-${id}`} x1="64" y1="40" x2="82" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mono ? "currentColor" : "#8f9097"} />
          <stop offset="1" stopColor={mono ? "currentColor" : "var(--nv-silver, #d4d5da)"} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#ring-${id})`} strokeWidth="5.5" />
      {/* Trazo izquierdo de la N */}
      <path d="M27 74 L27 33 L36 26 L36 67 Z" fill={`url(#stem-${id})`} />
      {/* Diagonal plegada */}
      <path d="M36 26 L45 26 L65 70 L56 74 Z" fill={`url(#diag-${id})`} />
      {/* Sombra del pliegue */}
      <path d="M56 74 L65 70 L62 62 Z" fill="#000" opacity={mono ? 0 : 0.22} />
      {/* Trazo ascendente que se convierte en flecha */}
      <path d="M56 74 L65 70 L74.5 38 L66 38 Z" fill={`url(#rise-${id})`} />
      <path d="M61 41 L79 19 L82 43 L74.5 38 Z" fill={`url(#arrow-${id})`} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[1.32em] font-bold tracking-[-0.04em]", className)} style={{ fontFamily: "var(--nv-font-display)" }}>
      <span>nova</span>
      <span className="text-gradient">lius</span>
    </span>
  );
}

/** Logotipo horizontal. Si el panel define un logotipo propio, se usa la imagen. */
export function Logo({ className, onDark = true, compact, to = "/" }: { className?: string; onDark?: boolean; compact?: boolean; to?: string | null }) {
  const { settings } = useSite();
  const custom = onDark ? settings.branding?.logo_dark_bg : settings.branding?.logo_light_bg;
  const useCustom = Boolean(custom) && !/novalius-horizontal-(dark|light)\.svg$/.test(custom ?? "");
  const content = useCustom ? (
    <img src={custom} alt={settings.company?.name ?? "Novalius"} className="h-8 w-auto" />
  ) : (
    <span className="inline-flex items-center gap-2.5">
      <NovaliusMark className="size-9 shrink-0" onDark={onDark} />
      {!compact && <Wordmark className={onDark ? "text-white" : "text-ink"} />}
    </span>
  );
  if (to === null) return <span className={className}>{content}</span>;
  return (
    <Link to={to} className={cn("inline-flex items-center", className)} aria-label={`${settings.company?.name ?? "Novalius"} · inicio`} data-cursor="link">
      {content}
    </Link>
  );
}

export function NovaAvatar({ className, pulse }: { className?: string; pulse?: boolean }) {
  const { settings } = useSite();
  const custom = settings.branding?.nova_avatar;
  if (custom && !custom.endsWith("/brand/nova-avatar.svg")) {
    return <img src={custom} alt="" className={cn("rounded-full object-cover", className)} />;
  }
  return (
    <span className={cn("relative inline-flex items-center justify-center rounded-full", className)} aria-hidden>
      {pulse && <span className="absolute inset-0 rounded-full bg-[var(--nv-secondary)] opacity-60" style={{ animation: "nv-pulse-ring 2.4s ease-out infinite" }} />}
      <span
        className="relative size-full rounded-full"
        style={{
          background: "radial-gradient(circle at 32% 28%, #fff 0%, var(--nv-lavender) 14%, var(--nv-secondary) 38%, var(--nv-primary) 62%, var(--nv-navy) 100%)",
          boxShadow: "0 0 0 1px rgba(255,255,255,.25) inset, 0 6px 24px -6px var(--nv-primary)",
        }}
      />
      <span className="absolute size-[38%] rounded-full bg-white/90 blur-[1px]" style={{ boxShadow: "0 0 12px 2px rgba(255,255,255,.7)" }} />
    </span>
  );
}
