import { useId } from 'react';

export type SegmentedOption<T extends string> = Readonly<{
  value: T;
  label: string;
}>;

export type SegmentedControlProps<T extends string> = Readonly<{
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  disabled?: boolean;
  onChange(value: T): void;
}>;

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className="segmented-control" role="radiogroup">
      <legend>{label}</legend>
      <div className="segmented-control__options">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={disabled}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
