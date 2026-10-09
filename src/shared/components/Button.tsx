import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

// Figma page 169:2: primary 214:2572 / 269:309, secondary 214:2482,
// outline 214:2580, danger 218:413. Interaction states are implementation additions.
const variantStyles = {
  primary: 'bg-brand text-surface shadow-brand enabled:hover:bg-brand-strong',
  secondary: 'bg-brand-secondary text-surface shadow-surface enabled:hover:bg-brand',
  outline: 'border border-border bg-surface text-text shadow-raised enabled:hover:bg-muted',
  danger: 'border border-danger/25 bg-surface text-danger shadow-surface enabled:hover:bg-danger/5 enabled:hover:border-danger/50',
};

const sizeStyles = {
  sm: 'min-h-8 rounded-compact px-3 pt-[6.5px] pb-[7.5px] text-xs leading-4',
  md: 'min-h-11 rounded-control px-4 py-0 text-sm leading-5',
  lg: 'min-h-12 rounded-control px-6 py-0 text-sm leading-5',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'relative inline-flex shrink-0 items-center justify-center gap-2 font-sans font-semibold text-center select-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';
  const isPrimaryLarge = variant === 'primary' && size === 'lg';
  // Authentication action 214:2482 is 96px wide; allow longer labels to grow.
  const isSecondaryMedium = variant === 'secondary' && size === 'md';

  return (
    <button
      {...props}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${isPrimaryLarge ? 'min-h-12 rounded-control px-6 pt-[11.75px] pb-[13.25px] text-[15px] leading-[22.5px]' : sizeStyles[size]}
        ${isSecondaryMedium ? 'min-w-24' : ''}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      aria-busy={loading ? true : props['aria-busy']}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
};
