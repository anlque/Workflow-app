import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  Readonly<{
    label: ReactNode;
    error?: ReactNode;
    hint?: ReactNode;
  }>;

export function Select({
  label,
  error,
  hint,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [
    props['aria-describedby'],
    hint === undefined ? undefined : hintId,
    error === undefined ? undefined : errorId,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={controlId}>
        {label}
      </label>
      <select
        {...props}
        id={controlId}
        className={['select', className].filter(Boolean).join(' ')}
        aria-describedby={describedBy || undefined}
        aria-invalid={error === undefined ? undefined : true}
      >
        {children}
      </select>
      {hint === undefined ? null : (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error === undefined ? null : (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
