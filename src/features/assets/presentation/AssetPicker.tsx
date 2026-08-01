import { Select } from '@/shared';

import type { Asset, AssetKind } from '../domain/Asset';

export type AssetPickerProps = Readonly<{
  label: string;
  kind: AssetKind;
  assets: readonly Asset[];
  value?: string | undefined;
  onChange(value: string | undefined): void;
}>;

export function AssetPicker({
  label,
  kind,
  assets,
  value,
  onChange,
}: AssetPickerProps) {
  return (
    <Select
      label={label}
      value={value ?? ''}
      onChange={(event) => {
        onChange(event.target.value || undefined);
      }}
    >
      <option value="">None</option>
      {assets
        .filter((asset) => asset.kind === kind)
        .map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.name}
          </option>
        ))}
    </Select>
  );
}
