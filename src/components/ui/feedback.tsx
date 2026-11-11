import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
type ToastKind = "success" | "error" | "info" | "warning";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}
const ToastCtx = createContext<{ toast: (kind: ToastKind, title: string, description?: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { id, kind, title, description }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const I = Icon[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-white/10 bg-[#121433]/95 p-4 text-sm text-white shadow-2xl backdrop-blur"
                role={t.kind === "error" ? "alert" : "status"}
              >
                <I className={cn("mt-0.5 size-5 shrink-0", t.kind === "success" && "text-success", t.kind === "error" && "text-danger", t.kind === "warning" && "text-warning", t.kind === "info" && "text-lavender")} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-white/70">{t.description}</p>}
                </div>
                <button className="text-white/50 hover:text-white" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Cerrar">
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx.toast;
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------
export function Spinner({ className, label = "Cargando" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-sm", className)} aria-hidden />;
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-tone px-6 py-14 text-center">
      {icon && <div className="text-[var(--nv-secondary)]">{icon}</div>}
      <p className="font-display text-lg">{title}</p>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "No se ha podido cargar", error, onRetry }: { title?: string; error?: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-danger/30 bg-danger/5 px-6 py-10 text-center" role="alert">
      <AlertTriangle className="size-6 text-danger" />
      <p className="font-medium">{title}</p>
      {msg && <p className="max-w-md text-sm text-muted">{msg}</p>}
      {onRetry && (
        <button className="text-sm font-medium text-[var(--nv-primary)] underline underline-offset-4" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  neutral: "bg-[color-mix(in_oklab,currentColor_10%,transparent)]",
  violet: "bg-[color-mix(in_oklab,var(--nv-primary)_18%,transparent)] text-[color-mix(in_oklab,var(--nv-primary)_60%,var(--tone-fg,white))]",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof badgeTones; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>{children}</span>;
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode; className?: string }) {
  const I = { info: Info, warning: AlertTriangle, danger: XCircle, success: CheckCircle2 }[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-sm border px-4 py-3 text-sm", tone === "info" && "border-info/30 bg-info/10", tone === "warning" && "border-warning/40 bg-warning/10", tone === "danger" && "border-danger/40 bg-danger/10", tone === "success" && "border-success/40 bg-success/10", className)}>
      <I className={cn("mt-0.5 size-4 shrink-0", { info: "text-info", warning: "text-warning", danger: "text-danger", success: "text-success" }[tone])} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
