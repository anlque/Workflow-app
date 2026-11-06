import { useId, type ChangeEventHandler } from 'react';

export type SwitchProps = Readonly<{
  label: string;
  displayLabel?: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}>;

export function Switch({
  label,
  displayLabel = label,
  description,
  checked,
  disabled = false,
  onChange,
}: SwitchProps) {
  const descriptionId = useId();
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange(event.currentTarget.checked);
  };

  return (
    <label className="switch-control">
      <span className="switch-control__copy">
        <strong>{displayLabel}</strong>
        {description === undefined ? null : (
          <span id={descriptionId}>{description}</span>
        )}
      </span>
      <span className="switch-control__input">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={label}
          aria-describedby={
            description === undefined ? undefined : descriptionId
          }
          onChange={handleChange}
        />
        <span className="switch-control__track" aria-hidden="true" />
      </span>
    </label>
  );
}
