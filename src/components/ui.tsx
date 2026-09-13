"use client";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/90 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)]",
  secondary: "bg-white text-ink border border-line hover:bg-cream-100 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.12)]",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  danger: "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200",
  light: "bg-white text-ink hover:bg-white/90 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]",
};
const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-xl",
  md: "h-10 px-4 text-sm gap-2 rounded-2xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  href?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, href, ...rest },
  ref,
) {
  const classes = cn(
    "inline-flex items-center justify-center font-bold whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none",
    variantClass[variant],
    sizeClass[size],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const inputClass =
  "w-full h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-ink/35 outline-none focus:border-ink/40 focus:ring-4 focus:ring-ink/5 transition disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputClass, "h-auto py-2 min-h-[72px] resize-y", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputClass, "appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink/50" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

export function Field({ label, help, error, children, className }: { label: string; help?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-bold text-ink/80">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-xs font-semibold text-rose-600">{error}</span> : help ? <span className="mt-1.5 block text-xs text-ink/50">{help}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-ink/[0.03]"
    >
      <span>
        <span className="block text-sm font-bold text-ink">{label}</span>
        {description && <span className="block text-xs text-ink/50">{description}</span>}
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-ink" : "bg-ink/15")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; className?: string }) {
  return (
    <div className={cn("inline-flex w-full rounded-2xl bg-ink/[0.06] p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          title={o.title}
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl px-2 py-1.5 text-[13px] font-bold transition-all",
            o.value === value ? "bg-white text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2)]" : "text-ink/55 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("rounded-3xl border border-line bg-white/80 p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)] backdrop-blur", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-ink/60">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "info"; className?: string }) {
  const tones = {
    neutral: "bg-ink/[0.06] text-ink/70",
    good: "bg-emerald-50 text-emerald-700",
    bad: "bg-rose-50 text-rose-700",
    info: "bg-sky-50 text-sky-700",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", tones[tone], className)}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink/70">{children}</kbd>;
}
