import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@/shared';

import type { Asset, AssetId, AssetKind } from '../domain/Asset';
import type { AssetRoleChangePreview } from '../application/AssetRoleChange';
import type {
  AssetRetirementChoice,
  AssetRetirementPreview,
} from '../application/AssetRetirement';
import type { ImportAssetInput } from '../application/importAssetUseCase';
import { AssetPreview } from './AssetPreview';
import { AssetRetirementDialog } from './AssetRetirementDialog';
import { AssetRoleDialog } from './AssetRoleDialog';

export type AssetLibraryProps = Readonly<{
  assets: readonly Asset[];
  onImport(file: File, kind: AssetKind): Promise<void>;
  onInspectRetirement(id: AssetId): Promise<AssetRetirementPreview>;
  onRetire(
    preview: AssetRetirementPreview,
    choice: AssetRetirementChoice,
  ): Promise<void>;
  onSynchronizeRetirement(): Promise<void>;
  createRetirementUploadInput(file: File, kind: AssetKind): ImportAssetInput;
  onInspectRoleChange(
    id: AssetId,
    value: string,
  ): Promise<AssetRoleChangePreview>;
  onApplyRoleChange(preview: AssetRoleChangePreview): Promise<void>;
  onSynchronizeRoleChange(): Promise<void>;
  loadBlob(id: AssetId): Promise<Blob | null>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
}>;

function formatBytes(value: number): string {
  if (value < 1_024) return `${String(value)} B`;
  if (value < 1_048_576) return `${String(Math.round(value / 1_024))} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export function AssetLibrary({
  assets,
  onImport,
  onInspectRetirement,
  onRetire,
  onSynchronizeRetirement,
  createRetirementUploadInput,
  onInspectRoleChange,
  onApplyRoleChange,
  onSynchronizeRoleChange,
  loadBlob,
  createObjectUrl,
  revokeObjectUrl,
}: AssetLibraryProps) {
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const library = useRef<HTMLElement | null>(null);
  const addAssetInput = useRef<HTMLInputElement | null>(null);
  const retirementFocusTarget = useRef<string | null>(null);
  const [managingRole, setManagingRole] = useState<Asset | null>(null);
  const roleTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreRoleFocus = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importFile(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    const kind: AssetKind | null = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('audio/')
        ? 'audio'
        : null;
    if (kind === null) {
      setError('Choose a supported image or audio file.');
      return;
    }
    setPending('import');
    setError(null);
    try {
      await onImport(file, kind);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed.');
    } finally {
      setPending(null);
    }
  }

  function closeRoleDialog(): void {
    restoreRoleFocus.current = true;
    setManagingRole(null);
  }

  useEffect(() => {
    if (managingRole !== null || !restoreRoleFocus.current) return;
    restoreRoleFocus.current = false;
    roleTrigger.current?.focus();
  }, [managingRole]);

  function closeRetirementDialog(): void {
    setDeleting(null);
    queueMicrotask(() => deleteTrigger.current?.focus());
  }

  function completeRetirement(choice: AssetRetirementChoice): void {
    retirementFocusTarget.current =
      choice.type === 'existing'
        ? choice.assetId
        : choice.type === 'upload'
          ? choice.input.id
          : 'add';
    setDeleting(null);
  }

  useEffect(() => {
    if (deleting !== null || retirementFocusTarget.current === null) return;
    const target = retirementFocusTarget.current;
    retirementFocusTarget.current = null;
    setTimeout(() => {
      if (target === 'add') addAssetInput.current?.focus();
      else {
        const trigger = Array.from(
          library.current?.querySelectorAll<HTMLButtonElement>(
            '[data-retirement-asset-id]',
          ) ?? [],
        ).find(({ dataset }) => dataset['retirementAssetId'] === target);
        trigger?.focus();
      }
    }, 0);
  }, [assets, deleting]);

  return (
    <section
      ref={library}
      className="asset-library"
      aria-labelledby="asset-library-title"
    >
      <header className="section-heading">
        <div>
          <h2 id="asset-library-title">Local Assets</h2>
          <p>Reusable images and ambient audio stored only in this browser.</p>
          <p>A Role lets Workflows follow whichever Asset owns that name.</p>
        </div>
        <label className="button button--primary asset-upload">
          {pending === 'import' ? 'Adding…' : 'Add asset'}
          <input
            ref={addAssetInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/ogg,audio/wav"
            aria-label="Add local image or audio"
            disabled={pending === 'import'}
            onChange={(event) => {
              void importFile(event);
            }}
          />
        </label>
      </header>

      {error === null || deleting !== null ? null : (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}

      {assets.length === 0 ? (
        <div className="asset-library__empty">
          <h3>Add atmosphere to your Workflows.</h3>
          <p>Upload a local background image or ambient audio track.</p>
        </div>
      ) : (
        <ul className="asset-list">
          {assets.map((asset) => (
            <li
              className="asset-item"
              key={asset.id}
              aria-label={`${asset.kind === 'image' ? 'Image' : 'Audio'}: ${asset.name}`}
            >
              <div className="asset-preview">
                <AssetPreview
                  asset={asset}
                  loadBlob={loadBlob}
                  createObjectUrl={createObjectUrl}
                  revokeObjectUrl={revokeObjectUrl}
                />
              </div>
              <div className="asset-item__body">
                <div>
                  <strong>{asset.name}</strong>
                  <p>
                    {asset.kind === 'image' ? 'Image' : 'Audio'} ·{' '}
                    {formatBytes(asset.byteSize)}
                  </p>
                  <p>Role: {asset.role ?? 'No Role'}</p>
                </div>
                <div className="asset-item__actions">
                  <Button
                    variant="quiet"
                    aria-label={`Manage role for ${asset.name}`}
                    onClick={(event) => {
                      roleTrigger.current = event.currentTarget;
                      setManagingRole(asset);
                    }}
                  >
                    Role
                  </Button>
                  <Button
                    data-retirement-asset-id={asset.id}
                    variant="quiet"
                    aria-label={`Retire ${asset.name}`}
                    onClick={(event) => {
                      deleteTrigger.current = event.currentTarget;
                      setDeleting(asset);
                    }}
                  >
                    Retire
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleting === null ? null : (
        <AssetRetirementDialog
          asset={deleting}
          assets={assets}
          onInspect={onInspectRetirement}
          onRetire={onRetire}
          onSynchronize={onSynchronizeRetirement}
          createUploadInput={createRetirementUploadInput}
          onCancel={closeRetirementDialog}
          onSuccess={completeRetirement}
        />
      )}
      {managingRole === null ? null : (
        <AssetRoleDialog
          asset={managingRole}
          onInspect={onInspectRoleChange}
          onApply={onApplyRoleChange}
          onSynchronize={onSynchronizeRoleChange}
          onCancel={closeRoleDialog}
          onSuccess={closeRoleDialog}
        />
      )}
    </section>
  );
}
