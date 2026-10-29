import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface CardProps extends ComponentPropsWithRef<'div'> {
  children: ReactNode;
  variant?: 'default' | 'classroom';
  padding?: 'none' | 'compact' | 'content' | 'list';
}

const paddingStyles = {
  none: 'p-0',
  compact: 'p-5',
  content: 'p-5 md:p-7',
  list: 'px-6 py-5',
};

// Figma page 169:2: shared shell 218:396 / 218:1715; classroom 218:267.
// Content padding: desktop 218:1943 (28px), mobile 269:633 (20px).
// The md breakpoint is an implementation choice, not a Figma design value.
export function Card({
  children,
  variant = 'default',
  padding,
  className = '',
  ...props
}: CardProps) {
  const spacing = padding
    ? paddingStyles[padding]
    : variant === 'classroom' ? 'py-6 pr-6 pl-8' : paddingStyles.content;

  return (
    <div
      {...props}
      className={`
        relative min-w-0 rounded-card border border-border bg-surface font-sans text-text shadow-surface
        ${spacing}
        ${variant === 'classroom' ? "overflow-hidden before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-brand before:content-['']" : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
