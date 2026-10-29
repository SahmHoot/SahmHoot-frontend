import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface InputProps extends ComponentPropsWithRef<'input'> {
  invalid?: boolean;
  endAdornment?: ReactNode;
}

// Figma page 169:2: 214:2556, 214:2563, 269:263, 269:270.
// Focus, disabled, and invalid appearances are implementation additions.
export function Input({
  invalid = false,
  endAdornment,
  className = '',
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  const hasError = invalid || (ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== 'false');
  const hasAdornment = endAdornment !== undefined && endAdornment !== null && endAdornment !== false;
  const input = (
    <input
      {...props}
      aria-invalid={invalid ? true : ariaInvalid}
      className={`
        block h-11 w-full min-w-0 rounded-control border bg-surface px-4 py-[11px]
        font-sans text-sm font-normal leading-[normal] text-text shadow-surface
        placeholder:text-text-muted/70 transition-colors duration-150 motion-reduce:transition-none
        focus-visible:outline-2 focus-visible:outline-offset-2
        disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-muted disabled:shadow-none
        ${hasError ? 'border-danger focus:border-danger focus-visible:outline-danger' : 'border-border-input focus:border-brand focus-visible:outline-brand'}
        ${hasAdornment ? 'pr-16' : ''}
        ${className}
      `}
    />
  );

  if (!hasAdornment) return input;

  return (
    <div className="relative w-full min-w-0">
      {input}
      <div className="absolute inset-y-0 right-3 flex items-center">
        {endAdornment}
      </div>
    </div>
  );
}
