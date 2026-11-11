import type { Project } from "@/types/content";
import { cn } from "@/lib/utils";

/** Portada generada para proyectos sin imagen (evita fotos de stock). */
export function ProjectCover({ project, className }: { project: Pick<Project, "title" | "cover_url" | "accent" | "category">; className?: string }) {
  if (project.cover_url) {
    return <img src={project.cover_url} alt="" loading="lazy" decoding="async" className={cn("size-full object-cover", className)} />;
  }
  const accent = project.accent || "var(--nv-primary)";
  return (
    <div className={cn("relative size-full overflow-hidden", className)} style={{ background: `radial-gradient(90% 80% at 85% 15%, color-mix(in oklab, ${accent} 75%, transparent), transparent 65%), radial-gradient(70% 70% at 10% 100%, color-mix(in oklab, var(--nv-indigo) 80%, transparent), transparent 70%), var(--nv-bg-dark)` }} aria-hidden>
      <div className="grid-lines absolute inset-0 opacity-40" style={{ ["--tone-line" as string]: "rgba(255,255,255,.07)" }} />
      <div className="absolute inset-x-[12%] bottom-0 top-[22%] rounded-t-xl border border-white/20 bg-white/[0.06] shadow-2xl backdrop-blur-sm transition-transform duration-700 group-hover:-translate-y-2">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-2 rounded-full bg-white/30" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/10" />
        </div>
        <div className="space-y-3 p-5">
          <div className="h-3 w-1/3 rounded-full" style={{ background: accent }} />
          <div className="h-6 w-3/4 rounded-md bg-white/25" />
          <div className="h-2.5 w-2/3 rounded-full bg-white/15" />
          <div className="grid grid-cols-3 gap-2 pt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-md bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
