import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";

export function AdminPage({ title, description, actions, children, tabs }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; tabs?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 md:px-8 md:pt-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-6">{tabs}</div>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; badge?: ReactNode }[] }) {
  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-tone px-4 scrollbar-none md:mx-0 md:px-0" role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)} className={cn("relative shrink-0 px-3.5 py-2.5 text-sm transition-colors", value === it.value ? "text-[var(--tone-fg)]" : "text-muted hover:text-[var(--tone-fg)]")}>
          <span className="flex items-center gap-1.5">
            {it.label}
            {it.badge}
          </span>
          {value === it.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary" />}
        </button>
      ))}
    </div>
  );
}

export function Card({ title, actions, children, className, description }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border border-tone bg-[var(--nv-surface-dark)]/60 p-5", className)} style={{ background: "color-mix(in oklab, var(--nv-surface-dark) 70%, transparent)" }}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-base">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "warning" | "success" }) {
  return (
    <div className="rounded-md border border-tone p-4" style={{ background: "color-mix(in oklab, var(--nv-surface-dark) 70%, transparent)" }}>
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <p className={cn("mt-3 font-display text-2xl tracking-tight", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id?: string | number }>({
  rows,
  columns,
  loading,
  error,
  onRowClick,
  searchKeys,
  searchPlaceholder = "Buscar…",
  empty = "No hay elementos.",
  toolbar,
  pageSize = 25,
  initialSort,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  error?: unknown;
  onRowClick?: (row: T) => void;
  searchKeys?: (keyof T | ((row: T) => string))[];
  searchPlaceholder?: string;
  empty?: ReactNode;
  toolbar?: ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = rows ?? [];
    const term = q.trim().toLowerCase();
    if (term && searchKeys?.length) {
      list = list.filter((r) => searchKeys.some((k) => String(typeof k === "function" ? k(r) : (r[k] ?? "")).toLowerCase().includes(term)));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const get = (r: T) => (col?.sortValue ? col.sortValue(r) : String((r as Record<string, unknown>)[sort.key] ?? ""));
      list = [...list].sort((a, b) => {
        const x = get(a);
        const y = get(b);
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
        return sort.dir === "asc" ? c : -c;
      });
    }
    return list;
  }, [rows, q, sort, searchKeys, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div>
      {(searchKeys || toolbar) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          {searchKeys && (
            <label className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                className="h-10 w-full rounded-sm border border-tone bg-white/[0.04] pl-9 pr-3 text-sm"
                placeholder={searchPlaceholder}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                aria-label={searchPlaceholder}
              />
            </label>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}
      {error ? (
        <ErrorState error={error} />
      ) : loading ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState title={typeof empty === "string" ? empty : "Sin resultados"} text={typeof empty === "string" ? undefined : empty} />
      ) : (
        <div className="overflow-hidden rounded-md border border-tone">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-tone bg-white/[0.03] text-xs text-muted">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-3 font-medium", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                      <button
                        className="inline-flex items-center gap-1 hover:text-[var(--tone-fg)]"
                        onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }))}
                      >
                        {c.label}
                        {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tone-line)]">
                {visible.map((row, i) => (
                  <tr
                    key={row.id ?? i}
                    className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-white/[0.04]")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-3 align-middle", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-tone px-4 py-2 text-xs text-muted">
              <span>
                {filtered.length} elementos · página {page + 1} de {pages}
              </span>
              <span className="flex gap-1">
                <button className="rounded p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                  <ChevronLeft className="size-4" />
                </button>
                <button className="rounded p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente">
                  <ChevronRight className="size-4" />
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Gráfica de líneas/áreas en SVG, accesible y ligera. */
export function LineChart({ data, series, height = 200 }: { data: Record<string, number | string>[]; series: { key: string; label: string; color: string }[]; height?: number }) {
  const width = 640;
  const pad = { l: 32, r: 8, t: 10, b: 24 };
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const x = (i: number) => pad.l + (i * (width - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Gráfica: ${series.map((s) => s.label).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity="0.08" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.5">
              {String(d.day ?? "").slice(5)}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key]) || 0)}`).join(" ");
          return (
            <g key={s.key}>
              <polygon points={`${x(0)},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}`} fill={s.color} fillOpacity="0.1" />
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function BarList({ items, color = "var(--nv-primary)" }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-muted">Sin datos en este periodo.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="font-mono text-xs text-muted">{i.value}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
