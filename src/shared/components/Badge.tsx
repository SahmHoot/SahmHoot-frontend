import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface BadgeProps extends ComponentPropsWithRef<'span'> {
  children: ReactNode;
  variant?: 'public' | 'private' | 'teacher' | 'correct' | 'selected';
  icon?: ReactNode;
}

// Only variants observed on Figma page 169:2: 218:403, 218:423,
// 218:2010, 218:2211, 218:2218. Icons remain caller-provided assets.
const variantStyles = {
  public: 'min-h-6 rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-semibold leading-4 text-brand',
  private: 'min-h-6 rounded-pill bg-muted px-2.5 py-1 text-xs font-semibold leading-4 text-text-muted',
  teacher: 'rounded-bubble-tail bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-[10px] text-surface',
  correct: 'min-h-6 rounded-pill bg-success px-2.5 py-1 text-[11px] font-bold leading-[15.71px] text-surface',
  selected: 'min-h-6 rounded-pill bg-danger/10 px-2.5 py-1 text-[11px] font-bold leading-[15.71px] text-danger',
};

export function Badge({
  children,
  variant = 'public',
  icon,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-sans ${variantStyles[variant]} ${className}`}
    >
      {icon != null && icon !== false && (
        <span aria-hidden="true" className="inline-flex size-3 shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
