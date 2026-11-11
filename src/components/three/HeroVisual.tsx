import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useSite } from "@/app/site";
import { usePrefs } from "@/app/prefs";

const HeroScene = lazy(() => import("./HeroScene"));

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Orbe CSS: alternativa ligera (sin WebGL, movimiento reducido o 3D desactivado). */
export function OrbFallback() {
  return (
    <div className="relative aspect-square w-full" aria-hidden>
      <div className="absolute inset-[14%] rounded-full animate-float" style={{ background: "radial-gradient(circle at 34% 30%, #fff 0%, var(--nv-lavender) 10%, var(--nv-secondary) 34%, var(--nv-primary) 56%, var(--nv-indigo) 76%, var(--nv-navy) 100%)", boxShadow: "0 0 120px 10px color-mix(in oklab, var(--nv-primary) 45%, transparent), inset -30px -40px 80px rgba(0,0,0,.35)" }} />
      <div className="absolute inset-[4%] rounded-full border border-[color-mix(in_oklab,var(--nv-lavender)_35%,transparent)] animate-spin-slow" style={{ transform: "rotateX(70deg)" }} />
      <div className="absolute inset-[-6%] rounded-full border border-[color-mix(in_oklab,var(--nv-lavender)_18%,transparent)]" />
    </div>
  );
}

export function HeroVisual() {
  const { animations, tokens } = useSite();
  const { motionEnabled } = usePrefs();
  const [canRender, setCanRender] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const small = window.matchMedia("(max-width: 767px)").matches;
    setCompact(small);
    const lowPower = (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 3;
    setCanRender(animations.three_d && motionEnabled && webglAvailable() && !lowPower);
  }, [animations.three_d, motionEnabled]);

  const c = tokens.colors;
  const colors = { core: c.navy!, mid: c.primary!, rim: c.secondary!, hot: c.lavender!, ring: c.lavender! };

  if (!canRender) return <OrbFallback />;
  return (
    <div className="relative aspect-square w-full">
      <SceneBoundary fallback={<OrbFallback />}>
        <Suspense fallback={<OrbFallback />}>
          <HeroScene colors={colors} intensity={animations.intensity} particles={animations.particles} compact={compact} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
