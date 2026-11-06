import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Button } from '@/shared';

import {
  createAssetId,
  type Asset,
  type AssetId,
  type AssetKind,
} from '../domain/Asset';
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
  const initialAsset = assets.find(({ kind }) => kind === 'image') ?? assets[0];
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
  const [selectedAssetId, setSelectedAssetId] = useState<AssetId | undefined>(
    initialAsset?.id,
  );
  const selectedAsset =
    assets.find(({ id }) => id === selectedAssetId) ?? initialAsset;

  useEffect(() => {
    if (
      selectedAssetId !== undefined &&
      assets.some(({ id }) => id === selectedAssetId)
    ) {
      return;
    }
    setSelectedAssetId(initialAsset?.id);
  }, [assets, initialAsset?.id, selectedAssetId]);

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
    if (choice.type === 'existing') setSelectedAssetId(choice.assetId);
    else if (choice.type === 'upload')
      setSelectedAssetId(createAssetId(choice.input.id));
    else setSelectedAssetId(undefined);
    setDeleting(null);
  }

  function openRoleDialog(asset: Asset, trigger: HTMLButtonElement): void {
    roleTrigger.current = trigger;
    setManagingRole(asset);
  }

  function openRetirementDialog(
    asset: Asset,
    trigger: HTMLButtonElement,
  ): void {
    deleteTrigger.current = trigger;
    setDeleting(asset);
  }

  function assetGroup(kind: AssetKind, label: string) {
    const values = assets.filter((asset) => asset.kind === kind);
    if (values.length === 0) return null;
    return (
      <section className="asset-library__group" role="group" aria-label={label}>
        <h3>{label}</h3>
        <ul
          className={`asset-list asset-list--${kind === 'image' ? 'images' : 'audio'}`}
        >
          {values.map((asset) => (
            <li
              className={`asset-item asset-item--${kind}`}
              key={asset.id}
              aria-label={`${asset.kind === 'image' ? 'Image' : 'Audio'}: ${asset.name}`}
              data-selected={
                selectedAsset?.id === asset.id ? 'true' : undefined
              }
            >
              {kind === 'image' ? (
                <button
                  className="asset-item__select"
                  type="button"
                  aria-label={`Select ${asset.name}`}
                  aria-pressed={selectedAsset?.id === asset.id}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                  }}
                >
                  <span className="asset-preview">
                    <AssetPreview
                      asset={asset}
                      loadBlob={loadBlob}
                      createObjectUrl={createObjectUrl}
                      revokeObjectUrl={revokeObjectUrl}
                    />
                  </span>
                  <span className="asset-item__summary">
                    <strong>{asset.name}</strong>
                    <span>Image · {formatBytes(asset.byteSize)}</span>
                    <span>Role: {asset.role ?? 'No Role'}</span>
                  </span>
                </button>
              ) : (
                <>
                  <span className="asset-audio-row__preview">
                    <AssetPreview
                      asset={asset}
                      loadBlob={loadBlob}
                      createObjectUrl={createObjectUrl}
                      revokeObjectUrl={revokeObjectUrl}
                    />
                  </span>
                  <button
                    className="asset-audio-row__select"
                    type="button"
                    aria-label={`Select ${asset.name}`}
                    aria-pressed={selectedAsset?.id === asset.id}
                    onClick={() => {
                      setSelectedAssetId(asset.id);
                    }}
                  >
                    <strong>{asset.name}</strong>
                    <span>Audio · {formatBytes(asset.byteSize)}</span>
                    <span>Role: {asset.role ?? 'No Role'}</span>
                  </button>
                </>
              )}
              {selectedAsset?.id === asset.id ? null : (
                <div className="asset-item__actions asset-item__actions--card">
                  <Button
                    variant="quiet"
                    aria-label={`Manage role for ${asset.name}`}
                    onClick={(event) => {
                      openRoleDialog(asset, event.currentTarget);
                    }}
                  >
                    Role
                  </Button>
                  <Button
                    data-retirement-asset-id={asset.id}
                    variant="quiet"
                    aria-label={`Retire ${asset.name}`}
                    onClick={(event) => {
                      openRetirementDialog(asset, event.currentTarget);
                    }}
                  >
                    Retire
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
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
        <div className="asset-library__workspace">
          <div className="asset-library__collections">
            {assetGroup('image', 'Images')}
            {assetGroup('audio', 'Audio')}
          </div>
          {selectedAsset === undefined ? null : (
            <aside
              className="asset-library__details"
              aria-label="Asset details"
            >
              <div>
                <span className="eyebrow">
                  {selectedAsset.kind === 'image' ? 'Image' : 'Audio'} asset
                </span>
                <h3>{selectedAsset.name}</h3>
                <p>
                  {selectedAsset.kind === 'image' ? 'Image' : 'Audio'} ·{' '}
                  {formatBytes(selectedAsset.byteSize)}
                </p>
                <p>Role: {selectedAsset.role ?? 'No Role'}</p>
              </div>
              <div className="asset-item__actions">
                <Button
                  variant="secondary"
                  aria-label={`Manage role for ${selectedAsset.name}`}
                  onClick={(event) => {
                    openRoleDialog(selectedAsset, event.currentTarget);
                  }}
                >
                  Manage Role
                </Button>
                <Button
                  data-retirement-asset-id={selectedAsset.id}
                  variant="danger"
                  aria-label={`Retire ${selectedAsset.name}`}
                  onClick={(event) => {
                    openRetirementDialog(selectedAsset, event.currentTarget);
                  }}
                >
                  Retire Asset
                </Button>
              </div>
            </aside>
          )}
        </div>
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
