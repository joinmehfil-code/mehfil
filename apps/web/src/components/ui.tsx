'use client';

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/* --------------------------------- Button --------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-ink-900 shadow-glow hover:shadow-glow-lg hover:brightness-105',
  secondary: 'glass text-content hover:bg-white/10',
  ghost: 'text-content-muted hover:bg-white/5 hover:text-content',
  danger: 'bg-red-600 text-white shadow-glow-rose hover:bg-red-700',
};
const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200',
        'active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

/* --------------------------------- Inputs --------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn('input', className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('input resize-y', className)} {...props} />;
});

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label">
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      {children}
      {hint && !error && <p className="text-xs text-content-muted">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* --------------------------------- Spinner -------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className ?? 'h-5 w-5',
      )}
      role="status"
      aria-label="loading"
    />
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <As className={cn('card', className)}>{children}</As>
  );
}

/* ---------------------------------- Badge --------------------------------- */

export function Badge({
  children,
  color = 'brand',
  className,
}: {
  children: ReactNode;
  color?: 'brand' | 'accent' | 'gray' | 'green' | 'red' | 'amber';
  className?: string;
}) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-500/15 text-brand-200 border border-brand-400/30',
    accent: 'bg-accent-500/15 text-accent-200 border border-accent-400/30',
    gray: 'bg-white/5 text-content-muted border border-white/10',
    green: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
    red: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
    amber: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- Avatar --------------------------------- */

export function Avatar({
  src,
  alt,
  size = 40,
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}) {
  const initials = (alt || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ''}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn('rounded-full object-cover ring-2 ring-white/15', className)}
    />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-brand-gradient font-bold text-ink-900 shadow-glow ring-2 ring-white/10',
        className,
      )}
    >
      {initials}
    </span>
  );
}

/* ------------------------------- EmptyState -------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass flex flex-col items-center justify-center gap-3 rounded-3xl px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-ink-900 shadow-glow">
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-content">{title}</p>
      {description && <p className="max-w-sm text-sm text-content-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* -------------------------------- Skeleton -------------------------------- */

/** Shimmering placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/** A stack of shimmering lines mimicking a card while content loads. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- GlassCard -------------------------------- */

/**
 * Frosted-glass panel with an optional gradient hairline top edge. The base
 * building block for the redesigned screens.
 */
export function GlassCard({
  children,
  className,
  as: As = 'div',
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
  accent?: boolean;
}) {
  return (
    <As
      className={cn(
        'glass relative overflow-hidden rounded-3xl transition-shadow duration-300 hover:shadow-glass',
        className,
      )}
    >
      {accent && <span className="gradient-rule absolute inset-x-0 top-0" />}
      {children}
    </As>
  );
}
