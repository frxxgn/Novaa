import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { cn, isExternal, safeHref } from "@/lib/utils";
import { Magnetic } from "@/components/motion/Magnetic";
import { track } from "@/lib/analytics";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,box-shadow,transform,border-color] duration-300 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 rounded-btn";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white shadow-[0_10px_40px_-12px_color-mix(in_oklab,var(--nv-primary)_calc(var(--nv-glow)*140%),transparent)] hover:bg-[color-mix(in_oklab,var(--nv-primary)_86%,white)] active:scale-[0.98]",
  secondary: "bg-[var(--tone-fg,white)] text-[var(--nv-ink)] hover:opacity-90 active:scale-[0.98] [.tone-light_&]:text-white",
  light: "bg-white text-[var(--nv-ink)] hover:bg-lavender active:scale-[0.98]",
  ghost: "text-[var(--tone-fg,currentColor)] hover:bg-[color-mix(in_oklab,currentColor_8%,transparent)]",
  outline: "border border-tone text-[var(--tone-fg,currentColor)] hover:border-[color-mix(in_oklab,var(--nv-secondary)_70%,transparent)] hover:bg-[color-mix(in_oklab,currentColor_5%,transparent)]",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-7 text-base tracking-wide",
};

interface Common {
  variant?: Variant;
  size?: Size;
  magnetic?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  trackId?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Common>(function Button(
  { variant = "primary", size = "md", magnetic, icon, iconRight, loading, className, children, trackId, onClick, ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      data-cursor="button"
      onClick={(e) => {
        if (trackId) track("cta_click", { id: trackId });
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
  return magnetic ? <Magnetic>{btn}</Magnetic> : btn;
});

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  magnetic,
  icon,
  iconRight,
  className,
  children,
  trackId,
  ...rest
}: Common & { to: string; children: ReactNode; className?: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const href = safeHref(to);
  const cls = cn(base, variants[variant], sizes[size], className);
  const onClick = () => {
    if (trackId) track("cta_click", { id: trackId });
  };
  const inner = (
    <>
      {icon}
      {children}
      {iconRight}
    </>
  );
  const el =
    isExternal(href) || href.startsWith("#") ? (
      <a href={href} className={cls} data-cursor="button" onClick={onClick} {...(isExternal(href) && !href.startsWith("mailto:") ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
        {inner}
      </a>
    ) : (
      <Link to={href} className={cls} data-cursor="button" onClick={onClick} {...rest}>
        {inner}
      </Link>
    );
  return magnetic ? <Magnetic>{el}</Magnetic> : el;
}
