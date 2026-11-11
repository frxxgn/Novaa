import type { AnimationSettings, DesignTokens } from "@/types/content";

export const FONT_FAMILIES: Record<string, string> = {
  Sora: '"Sora Variable", "Sora", ui-sans-serif, system-ui, sans-serif',
  Inter: '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif',
  Manrope: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif',
  "Space Grotesk": '"Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  Fraunces: '"Fraunces Variable", "Fraunces", ui-serif, Georgia, serif',
  Oswald: '"Oswald Variable", "Oswald", ui-sans-serif, system-ui, sans-serif',
  "IBM Plex Mono": '"IBM Plex Mono", ui-monospace, monospace',
};

export const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    primary: "#6c26e8",
    secondary: "#a540fb",
    lavender: "#c9b8f5",
    ink: "#010f40",
    navy: "#07195e",
    indigo: "#301e9f",
    silver: "#b9babe",
    bg_dark: "#05061a",
    surface_dark: "#0d0f2b",
    bg_light: "#f6f4fd",
    surface_light: "#ffffff",
    text_on_dark: "#f3f1ff",
    text_on_light: "#0b0c26",
    success: "#15a36a",
    warning: "#d98a06",
    danger: "#e0364f",
    info: "#2f6fe4",
  },
  typography: { display: "Sora", body: "Inter", mono: "IBM Plex Mono", scale: 1, display_weight: 600, display_tracking: -0.045 },
  radius: { sm: 10, md: 18, lg: 30 },
  spacing: { section: 136, container: 1320, gutter: 24 },
  effects: { glow: 0.55, shadow: 0.22, glass_opacity: 0.07, glass_blur: 18, border_opacity: 0.12, noise: 0.04 },
  buttons: { shape: "pill", magnetic: true },
  cards: { style: "glass", tilt: true },
};

export const DEFAULT_ANIMATIONS: AnimationSettings = {
  enabled: true,
  intro: true,
  intro_duration: 2.4,
  speed: 1,
  intensity: 1,
  scroll_reveal: "rise",
  magnetic_strength: 0.35,
  cursor: true,
  smooth_scroll: true,
  three_d: true,
  particles: true,
  page_transitions: true,
  sound: true,
};

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const isColor = (v: unknown): v is string => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);

/** Mezcla tokens guardados con los valores por defecto y aplica límites seguros. */
export function normalizeTokens(input: Partial<DesignTokens> | null | undefined): DesignTokens {
  const t = input ?? {};
  const colors = { ...DEFAULT_TOKENS.colors };
  for (const [k, v] of Object.entries(t.colors ?? {})) if (isColor(v)) colors[k] = v;
  const typography = { ...DEFAULT_TOKENS.typography, ...(t.typography ?? {}) };
  if (!FONT_FAMILIES[typography.display]) typography.display = DEFAULT_TOKENS.typography.display;
  if (!FONT_FAMILIES[typography.body]) typography.body = DEFAULT_TOKENS.typography.body;
  typography.scale = clamp(typography.scale, 0.8, 1.25, 1);
  typography.display_weight = clamp(typography.display_weight, 300, 800, 600);
  typography.display_tracking = clamp(typography.display_tracking, -0.08, 0.05, -0.045);
  return {
    colors,
    typography,
    radius: {
      sm: clamp(t.radius?.sm, 0, 24, 10),
      md: clamp(t.radius?.md, 0, 36, 18),
      lg: clamp(t.radius?.lg, 0, 56, 30),
    },
    spacing: {
      section: clamp(t.spacing?.section, 64, 220, 136),
      container: clamp(t.spacing?.container, 960, 1680, 1320),
      gutter: clamp(t.spacing?.gutter, 16, 48, 24),
    },
    effects: {
      glow: clamp(t.effects?.glow, 0, 1, 0.55),
      shadow: clamp(t.effects?.shadow, 0, 0.6, 0.22),
      glass_opacity: clamp(t.effects?.glass_opacity, 0, 0.3, 0.07),
      glass_blur: clamp(t.effects?.glass_blur, 0, 40, 18),
      border_opacity: clamp(t.effects?.border_opacity, 0.04, 0.4, 0.12),
      noise: clamp(t.effects?.noise, 0, 0.15, 0.04),
    },
    buttons: { shape: (["pill", "rounded", "square"] as const).includes(t.buttons?.shape as "pill") ? t.buttons!.shape : "pill", magnetic: t.buttons?.magnetic ?? true },
    cards: { style: (["glass", "solid", "outline"] as const).includes(t.cards?.style as "glass") ? t.cards!.style : "glass", tilt: t.cards?.tilt ?? true },
  };
}

/** Las animaciones nunca pueden configurarse de forma que impidan navegar. */
export function normalizeAnimations(input: Partial<AnimationSettings> | null | undefined): AnimationSettings {
  const a = { ...DEFAULT_ANIMATIONS, ...(input ?? {}) };
  return {
    ...a,
    intro_duration: clamp(a.intro_duration, 0.8, 4, 2.4),
    speed: clamp(a.speed, 0.5, 2, 1),
    intensity: clamp(a.intensity, 0, 1.5, 1),
    magnetic_strength: clamp(a.magnetic_strength, 0, 0.6, 0.35),
    scroll_reveal: (["rise", "fade", "blur", "scale", "none"] as const).includes(a.scroll_reveal) ? a.scroll_reveal : "rise",
  };
}

export function tokensToCssVars(t: DesignTokens, a?: AnimationSettings): Record<string, string> {
  const c = t.colors;
  const vars: Record<string, string> = {
    "--nv-primary": c.primary!,
    "--nv-secondary": c.secondary!,
    "--nv-lavender": c.lavender!,
    "--nv-ink": c.ink!,
    "--nv-navy": c.navy!,
    "--nv-indigo": c.indigo!,
    "--nv-silver": c.silver!,
    "--nv-bg-dark": c.bg_dark!,
    "--nv-surface-dark": c.surface_dark!,
    "--nv-bg-light": c.bg_light!,
    "--nv-surface-light": c.surface_light!,
    "--nv-text-on-dark": c.text_on_dark!,
    "--nv-text-on-light": c.text_on_light!,
    "--nv-success": c.success!,
    "--nv-warning": c.warning!,
    "--nv-danger": c.danger!,
    "--nv-info": c.info!,
    "--nv-font-display": FONT_FAMILIES[t.typography.display]!,
    "--nv-font-body": FONT_FAMILIES[t.typography.body]!,
    "--nv-type-scale": String(t.typography.scale),
    "--nv-display-weight": String(t.typography.display_weight),
    "--nv-display-tracking": `${t.typography.display_tracking}em`,
    "--nv-radius-sm": `${t.radius.sm}px`,
    "--nv-radius-md": `${t.radius.md}px`,
    "--nv-radius-lg": `${t.radius.lg}px`,
    "--nv-btn-radius": t.buttons.shape === "pill" ? "999px" : t.buttons.shape === "rounded" ? `${t.radius.sm}px` : "2px",
    "--nv-section-space": `${t.spacing.section}px`,
    "--nv-container": `${t.spacing.container}px`,
    "--nv-gutter": `${t.spacing.gutter}px`,
    "--nv-glow": String(t.effects.glow),
    "--nv-shadow": String(t.effects.shadow),
    "--nv-glass-opacity": String(t.effects.glass_opacity),
    "--nv-glass-blur": `${t.effects.glass_blur}px`,
    "--nv-border-opacity": String(t.effects.border_opacity),
    "--nv-noise": String(t.effects.noise),
  };
  if (a) {
    vars["--nv-motion-speed"] = String(a.speed);
    vars["--nv-motion-intensity"] = String(a.intensity);
  }
  return vars;
}

export function applyDesign(t: DesignTokens, a: AnimationSettings, target: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(tokensToCssVars(t, a))) target.style.setProperty(k, v);
}

/** Contraste WCAG entre dos colores hexadecimales. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}
