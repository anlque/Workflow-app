import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';

type FieldControlProps = Readonly<{
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}>;

export type FieldProps = Readonly<{
  label: ReactNode;
  children: ReactElement<FieldControlProps>;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}>;

export function Field({ label, children, hint, error, className }: FieldProps) {
  const generatedId = useId();
  const controlId = children.props.id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [
    children.props['aria-describedby'],
    hint === undefined ? undefined : hintId,
    error === undefined ? undefined : errorId,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={controlId}>
        {label}
      </label>
      {cloneElement(children, {
        id: controlId,
        ...(describedBy.length === 0
          ? {}
          : { 'aria-describedby': describedBy }),
        ...(error === undefined ? {} : { 'aria-invalid': true }),
      })}
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
