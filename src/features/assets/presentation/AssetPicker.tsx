import { useRef, useState, type ChangeEvent } from 'react';

import { Button, Select } from '@/shared';

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

export type AssetPickerUpload = (file: File, kind: AssetKind) => Promise<Asset>;
export type AssetPickerUploadSynchronization = () => Promise<void>;

export type AssetPickerProps = Readonly<{
  label: string;
  kind: AssetKind;
  assets: readonly Asset[];
  value?: AssetPickerValue | undefined;
  onChange(value: AssetPickerValue | undefined): void;
  onUpload?: AssetPickerUpload | undefined;
  onSynchronizeUpload?: AssetPickerUploadSynchronization | undefined;
}>;

export function AssetPicker({
  label,
  kind,
  assets,
  value,
  onChange,
  onUpload,
  onSynchronizeUpload,
}: AssetPickerProps) {
  const [uploadState, setUploadState] = useState<
    'idle' | 'committing' | 'synchronizing' | 'recovery'
  >('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadPending = useRef(false);
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
  const accept =
    kind === 'image'
      ? 'image/png,image/jpeg,image/webp'
      : 'audio/mpeg,audio/ogg,audio/wav';

  async function synchronize(): Promise<void> {
    if (onSynchronizeUpload === undefined) return;
    setUploadState('synchronizing');
    try {
      await onSynchronizeUpload();
      setUploadError(null);
      setUploadState('idle');
    } catch {
      setUploadError(
        'Asset was added, but the catalog could not be refreshed.',
      );
      setUploadState('recovery');
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined || onUpload === undefined || uploadPending.current) {
      return;
    }
    uploadPending.current = true;
    setUploadState('committing');
    setUploadError(null);
    try {
      const asset = await onUpload(file, kind);
      onChange({ type: 'direct', assetId: asset.id });
      await synchronize();
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'Upload failed.');
      setUploadState('idle');
    } finally {
      uploadPending.current = false;
    }
  }

  return (
    <div className="asset-picker">
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
            <option value={selectedToken}>
              {unavailableRole} — unavailable
            </option>
          )}
        </optgroup>
      </Select>
      {onUpload === undefined || onSynchronizeUpload === undefined ? null : (
        <div className="asset-picker__upload">
          <label className="button button--quiet asset-upload">
            {uploadState === 'committing'
              ? 'Adding…'
              : uploadState === 'synchronizing'
                ? 'Refreshing…'
                : `Upload ${kind}`}
            <input
              type="file"
              accept={accept}
              aria-label={`Upload ${kind}`}
              disabled={uploadState !== 'idle'}
              onChange={(event) => {
                void upload(event);
              }}
            />
          </label>
          {uploadState === 'recovery' ? (
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                if (uploadPending.current) return;
                uploadPending.current = true;
                void synchronize().finally(() => {
                  uploadPending.current = false;
                });
              }}
            >
              Retry sync
            </Button>
          ) : null}
        </div>
      )}
      {uploadError === null ? null : (
        <p className="feedback feedback--error" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
