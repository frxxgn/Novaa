// Preferencias del visitante: consentimiento, sonido y movimiento reducido.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { safeStorage } from "@/lib/utils";
import { useSite } from "./site";

type Consent = { analytics: boolean; version: string; at: string } | null;

interface PrefsCtx {
  consent: Consent;
  setConsent: (analytics: boolean) => void;
  reopenConsent: () => void;
  consentOpen: boolean;
  sound: boolean;
  toggleSound: () => void;
  reducedMotion: boolean;
  motionEnabled: boolean;
  playTick: (kind?: "hover" | "click" | "success" | "error") => void;
}

const Ctx = createContext<PrefsCtx | null>(null);

function readConsent(version: string): Consent {
  try {
    const raw = safeStorage.get("nv-consent");
    if (!raw) return null;
    const c = JSON.parse(raw) as NonNullable<Consent>;
    return c.version === version ? c : null;
  } catch {
    return null;
  }
}

let audioCtx: AudioContext | null = null;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { settings, animations } = useSite();
  const version = settings.cookies?.version ?? "1";
  const [consent, setConsentState] = useState<Consent>(() => readConsent(version));
  const [consentOpen, setConsentOpen] = useState(false);
  const [sound, setSound] = useState(() => safeStorage.get("nv-sound") === "on");
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    setConsentState(readConsent(version));
  }, [version]);

  const motionEnabled = animations.enabled && !reducedMotion;

  useEffect(() => {
    document.documentElement.classList.toggle("nv-reduce-motion", !motionEnabled);
  }, [motionEnabled]);

  const setConsent = useCallback(
    (analytics: boolean) => {
      const c = { analytics, version, at: new Date().toISOString() };
      safeStorage.set("nv-consent", JSON.stringify(c));
      setConsentState(c);
      setConsentOpen(false);
    },
    [version],
  );

  const toggleSound = useCallback(() => {
    setSound((s) => {
      safeStorage.set("nv-sound", s ? "off" : "on");
      return !s;
    });
  }, []);

  // Sonidos de interfaz sintetizados (sin archivos). Desactivados por defecto.
  const playTick = useCallback(
    (kind: "hover" | "click" | "success" | "error" = "click") => {
      if (!sound || !animations.sound) return;
      try {
        audioCtx ??= new AudioContext();
        const ctx = audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = { hover: 880, click: 520, success: 760, error: 220 }[kind];
        osc.type = kind === "error" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (kind === "success") osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(kind === "hover" ? 0.015 : 0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "success" ? 0.35 : 0.12));
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch {
        /* audio no disponible */
      }
    },
    [sound, animations.sound],
  );

  const value = useMemo(
    () => ({ consent, setConsent, reopenConsent: () => setConsentOpen(true), consentOpen, sound, toggleSound, reducedMotion, motionEnabled, playTick }),
    [consent, setConsent, consentOpen, sound, toggleSound, reducedMotion, motionEnabled, playTick],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs debe usarse dentro de PrefsProvider");
  return ctx;
}
