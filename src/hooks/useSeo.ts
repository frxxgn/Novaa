import { useEffect } from "react";
import { useLocation } from "react-router";
import { useSite } from "@/app/site";

interface SeoInput {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  type?: "website" | "article";
}

function setMeta(attr: "name" | "property", key: string, content: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Metadatos SEO por página (título, descripción, Open Graph, canonical y JSON-LD). */
export function useSeo(input: SeoInput) {
  const { settings } = useSite();
  const { pathname } = useLocation();
  const seo = settings.seo_defaults;
  const base = (seo.site_url || window.location.origin).replace(/\/$/, "");
  const title = input.title ? (seo.title_template || "%s").replace("%s", input.title) : seo.default_title;
  const description = input.description || seo.description;
  const image = input.image || seo.og_image;
  const absImage = image ? (image.startsWith("http") ? image : `${base}${image}`) : undefined;
  const canonical = input.canonical || `${base}${pathname === "/" ? "/" : pathname}`;
  const json = input.jsonLd ? JSON.stringify(input.jsonLd) : "";

  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", input.noindex ? "noindex, nofollow" : "index, follow");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", input.type ?? "website");
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", absImage);
    setMeta("property", "og:site_name", settings.company.name);
    setMeta("property", "og:locale", "es_ES");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:site", seo.twitter_handle || undefined);
    setLink("canonical", canonical);

    const id = "nv-jsonld";
    document.getElementById(id)?.remove();
    if (json) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = id;
      s.textContent = json;
      document.head.appendChild(s);
    }
  }, [title, description, absImage, canonical, input.noindex, input.type, json, settings.company.name, seo.twitter_handle]);
}
