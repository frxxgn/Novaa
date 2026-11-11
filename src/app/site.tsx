import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { applyDesign, DEFAULT_ANIMATIONS, DEFAULT_TOKENS, normalizeAnimations, normalizeTokens } from "@/lib/design";
import { safeStorage } from "@/lib/utils";
import { DEFAULT_SETTINGS, fetchSiteBundle } from "@/services/content";
import type { AnimationSettings, DesignTokens, NavItem, SiteSettings } from "@/types/content";

interface SiteCtx {
  settings: SiteSettings;
  tokens: DesignTokens;
  animations: AnimationSettings;
  nav: NavItem[];
  translations: { key: string; locale: string; value: string }[];
  loading: boolean;
  error: unknown;
}

const Ctx = createContext<SiteCtx | null>(null);
const CACHE_KEY = "nv-design-cache";

/** Diseño en caché local: evita parpadeos al aplicar los tokens publicados. */
function cachedDesign(): { tokens: DesignTokens; animations: AnimationSettings } {
  try {
    const raw = safeStorage.get(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { tokens: DesignTokens; animations: AnimationSettings };
      return { tokens: normalizeTokens(parsed.tokens), animations: normalizeAnimations(parsed.animations) };
    }
  } catch {
    /* caché corrupta */
  }
  return { tokens: DEFAULT_TOKENS, animations: DEFAULT_ANIMATIONS };
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(cachedDesign, []);
  const query = useQuery({ queryKey: ["site-bundle"], queryFn: fetchSiteBundle, staleTime: 60_000, retry: 1 });

  const value = useMemo<SiteCtx>(
    () => ({
      settings: query.data?.settings ?? DEFAULT_SETTINGS,
      tokens: query.data?.tokens ?? initial.tokens,
      animations: query.data?.animations ?? initial.animations,
      nav: query.data?.nav ?? [],
      translations: query.data?.translations ?? [],
      loading: query.isLoading,
      error: query.error,
    }),
    [query.data, query.isLoading, query.error, initial],
  );

  useEffect(() => {
    // Las páginas del panel aplican su propio diseño de previsualización
    if (document.documentElement.dataset.designLocked === "1") return;
    applyDesign(value.tokens, value.animations);
    if (query.data) safeStorage.set(CACHE_KEY, JSON.stringify({ tokens: value.tokens, animations: value.animations }));
  }, [value.tokens, value.animations, query.data]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite(): SiteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSite debe usarse dentro de SiteProvider");
  return ctx;
}

/** Reemplaza tokens/animaciones dentro de un subárbol (previsualizaciones del panel). */
export function SiteOverride({ tokens, animations, children }: { tokens?: DesignTokens; animations?: AnimationSettings; children: ReactNode }) {
  const parent = useSite();
  const value = useMemo(() => ({ ...parent, tokens: tokens ?? parent.tokens, animations: animations ?? parent.animations }), [parent, tokens, animations]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
