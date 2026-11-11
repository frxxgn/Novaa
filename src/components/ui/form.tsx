import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-sm border border-tone bg-[color-mix(in_oklab,currentColor_4%,transparent)] px-3.5 text-[0.95rem] text-[var(--tone-fg,inherit)] placeholder:text-[var(--tone-muted)] transition-[border-color,box-shadow] focus:border-[var(--nv-secondary)] focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--nv-secondary)_18%,transparent)] focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Field({ label, hint, error, children, required, className, id }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; required?: boolean; className?: string; id?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-[var(--nv-secondary)]" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, className, wrapperClassName, id, required, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} id={inputId}>
      <input ref={ref} id={inputId} required={required} aria-invalid={Boolean(error) || undefined} className={cn(control, "h-11", className)} {...rest} />
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; wrapperClassName?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, className, wrapperClassName, id, required, rows = 4, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} id={inputId}>
      <textarea ref={ref} id={inputId} rows={rows} required={required} aria-invalid={Boolean(error) || undefined} className={cn(control, "py-2.5 leading-relaxed", className)} {...rest} />
    </Field>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null; options: { value: string; label: string }[]; wrapperClassName?: string; placeholder?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, options, className, wrapperClassName, id, required, placeholder, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName} id={inputId}>
      <select ref={ref} id={inputId} required={required} aria-invalid={Boolean(error) || undefined} className={cn(control, "h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")" }} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
});

export function Checkbox({ label, checked, onChange, id, required, disabled, description }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; id?: string; required?: boolean; disabled?: boolean; description?: ReactNode }) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-3 text-sm", disabled && "opacity-60")}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-[5px] border border-tone accent-[var(--nv-primary)]"
        checked={checked}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="leading-snug">
        {label}
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4", disabled && "opacity-60")}>
      {label && (
        <label htmlFor={id} className="text-sm">
          <span className="font-medium">{label}</span>
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full border border-tone transition-colors", checked ? "bg-primary" : "bg-[color-mix(in_oklab,currentColor_14%,transparent)]")}
      >
        <span className={cn("absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-transform", checked ? "translate-x-[21px]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function RangeInput({ label, value, onChange, min, max, step, format }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="font-mono text-xs text-muted">{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--nv-primary)]" />
    </div>
  );
}
