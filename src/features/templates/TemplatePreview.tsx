import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Template } from "@/types/content";
import { DemoSite } from "./DemoSite";

export const DEVICE_SIZES = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1100 },
  mobile: { width: 390, height: 820 },
} as const;

/**
 * Previsualización REAL de una plantilla: la demo funcional renderizada a su
 * tamaño de dispositivo y escalada al contenedor. La demo usa container
 * queries, así que su diseño responde al ancho simulado (móvil, tablet…).
 */
export function TemplatePreview({ template, device = "desktop", interactive = false, className }: { template: Template; device?: keyof typeof DEVICE_SIZES; interactive?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0.3);
  const { width, height } = DEVICE_SIZES[device];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    const update = () => setScale(el.clientWidth / width);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, [width]);

  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${width}/${height}`, background: template.theme.bg }}>
      {visible ? (
        <div
          className={cn("absolute left-0 top-0 origin-top-left", !interactive && "pointer-events-none select-none")}
          style={{ width, height, transform: `scale(${scale})` }}
          aria-hidden={!interactive}
          inert={!interactive ? true : undefined}
        >
          <DemoSite template={template} scrollable={interactive} />
        </div>
      ) : (
        <div className="skeleton absolute inset-0" style={{ color: template.theme.text }} />
      )}
    </div>
  );
}
