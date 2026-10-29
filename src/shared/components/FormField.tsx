import { cloneElement, useId } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import type { InputProps } from './Input';

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inputId?: string;
  children: ReactElement<InputProps>;
}

// Figma label 214:2554: 12px / 600 / 16px, text opacity 80%, input gap 6px.
// Hint/error presentation and accessibility wiring are implementation additions.
export function FormField({
  label,
  hint,
  error,
  inputId,
  children,
  className = '',
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = inputId ?? children.props.id ?? generatedId;
  const hasHint = hint !== undefined && hint !== null && hint !== false && hint !== '';
  const hasError = error !== undefined && error !== null && error !== false && error !== '';
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [...new Set([
    ...(children.props['aria-describedby']?.split(/\s+/).filter(Boolean) ?? []),
    ...(hasHint ? [hintId] : []),
    ...(hasError ? [errorId] : []),
  ])].join(' ') || undefined;

  return (
    <div {...props} className={`flex min-w-0 flex-col gap-1.5 font-sans ${className}`}>
      <label
        htmlFor={fieldId}
        className={`text-xs font-semibold leading-4 text-text/80 ${children.props.disabled ? 'opacity-50' : ''}`}
      >
        {label}
        {children.props.required && <span aria-hidden="true"> *</span>}
      </label>
      {cloneElement(children, {
        id: fieldId,
        'aria-invalid': hasError ? true : children.props['aria-invalid'],
        'aria-describedby': describedBy,
      })}
      {hasHint && (
        <p id={hintId} className="text-xs font-normal leading-4 text-text-muted">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} role="alert" className="text-xs font-normal leading-4 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
