import { Select } from '@/shared';

import {
  assetRoleKey,
  type Asset,
  type AssetId,
  type AssetKind,
  type AssetRole,
} from '../domain/Asset';

export type AssetPickerValue =
  | Readonly<{ type: 'direct'; assetId: AssetId }>
  | Readonly<{ type: 'role'; role: AssetRole }>;

export type AssetPickerProps = Readonly<{
  label: string;
  kind: AssetKind;
  assets: readonly Asset[];
  value?: AssetPickerValue | undefined;
  onChange(value: AssetPickerValue | undefined): void;
}>;

export function AssetPicker({
  label,
  kind,
  assets,
  value,
  onChange,
}: AssetPickerProps) {
  const directAssets = assets.filter((asset) => asset.kind === kind);
  const roleAssets = directAssets.flatMap((asset) =>
    asset.role === undefined ? [] : [{ asset, role: asset.role }],
  );
  const options = new Map<string, AssetPickerValue>();
  directAssets.forEach((asset) =>
    options.set(`direct:${asset.id}`, { type: 'direct', assetId: asset.id }),
  );
  roleAssets.forEach(({ role }) => {
    options.set(`role:${assetRoleKey(role)}`, {
      type: 'role',
      role,
    });
  });
  const selectedToken =
    value === undefined
      ? ''
      : value.type === 'direct'
        ? `direct:${value.assetId}`
        : `role:${assetRoleKey(value.role)}`;
  const unavailableRole =
    value?.type === 'role' && !options.has(selectedToken)
      ? value.role
      : undefined;
  return (
    <Select
      label={label}
      value={selectedToken}
      onChange={(event) => {
        onChange(
          event.target.value === ''
            ? undefined
            : options.get(event.target.value),
        );
      }}
    >
      <option value="">None</option>
      <optgroup label="Choose Asset directly">
        {directAssets.map((asset) => (
          <option key={asset.id} value={`direct:${asset.id}`}>
            {asset.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Follow Role">
        {roleAssets.map(({ asset, role }) => (
          <option key={asset.id} value={`role:${assetRoleKey(role)}`}>
            {role} — {asset.name}
          </option>
        ))}
        {unavailableRole === undefined ? null : (
          <option value={selectedToken}>{unavailableRole} — unavailable</option>
        )}
      </optgroup>
    </Select>
  );
}
