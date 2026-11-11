// Sistema de traducciones centralizado: diccionarios en código (es completo,
// en preparado) + sobrescrituras gestionables desde el panel (tabla translations).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { safeStorage } from "@/lib/utils";
import { es } from "./es";
import { en } from "./en";
import type { I18n } from "@/types/content";

export type Dict = Record<string, string>;
const BUILTIN: Record<string, Dict> = { es, en };

interface I18nCtx {
  locale: string;
  locales: string[];
  setLocale: (l: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Devuelve el campo traducido de una fila de contenido (columna i18n). */
  tr: <T extends { i18n?: I18n }>(row: T, field: keyof T & string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children, enabled, defaultLocale, overrides }: { children: ReactNode; enabled: string[]; defaultLocale: string; overrides: { key: string; locale: string; value: string }[] }) {
  const [locale, setLocaleState] = useState(() => {
    const stored = safeStorage.get("nv-locale");
    return stored && enabled.includes(stored) ? stored : defaultLocale;
  });

  useEffect(() => {
    if (!enabled.includes(locale)) setLocaleState(defaultLocale);
  }, [enabled, defaultLocale, locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const dict = useMemo(() => {
    const base = { ...BUILTIN.es, ...(BUILTIN[locale] ?? {}) };
    for (const o of overrides) {
      if (o.locale === locale) base[o.key] = o.value;
    }
    return base;
  }, [locale, overrides]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = dict[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [dict],
  );

  const tr = useCallback(
    <T extends { i18n?: I18n }>(row: T, field: keyof T & string) => {
      const value = row.i18n?.[locale]?.[field];
      return typeof value === "string" && value ? value : String(row[field] ?? "");
    },
    [locale],
  );

  const setLocale = useCallback((l: string) => {
    setLocaleState(l);
    safeStorage.set("nv-locale", l);
  }, []);

  const value = useMemo(() => ({ locale, locales: enabled, setLocale, t, tr }), [locale, enabled, setLocale, t, tr]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fuera del proveedor (p. ej. demos aisladas): español por defecto
    return {
      locale: "es",
      locales: ["es"],
      setLocale: () => undefined,
      t: (k, vars) => {
        let s = es[k] ?? k;
        if (vars) for (const [key, v] of Object.entries(vars)) s = s.replaceAll(`{${key}}`, String(v));
        return s;
      },
      tr: (row, field) => String(row[field] ?? ""),
    };
  }
  return ctx;
}

export const TRANSLATION_KEYS = Object.keys(es);
