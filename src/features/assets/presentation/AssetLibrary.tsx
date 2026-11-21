import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Button, Icon, SegmentedControl, Select } from '@/shared';

import {
  createAssetId,
  assetRoleKey,
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
import { AssetPreview, type AssetPreviewMetadata } from './AssetPreview';
import { AssetRetirementDialog } from './AssetRetirementDialog';
import { AssetRoleDialog } from './AssetRoleDialog';

export type AssetLibraryProps = Readonly<{
  assets: readonly Asset[];
  usageSummaries?: ReadonlyMap<AssetId, AssetUsageSummary>;
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

export type AssetUsageSummary = Readonly<{
  workflowCount: number;
  workflows: readonly Readonly<{ id: string; name: string }>[];
  occurrences: number;
}>;

type AssetKindFilter = 'all' | AssetKind;

function formatBytes(value: number): string {
  if (value < 1_024) return `${String(value)} B`;
  if (value < 1_048_576) return `${String(Math.round(value / 1_024))} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function formatDuration(value: number): string {
  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export function AssetLibrary({
  assets,
  usageSummaries = new Map(),
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
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<AssetKindFilter>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [openActionsId, setOpenActionsId] = useState<AssetId | null>(null);
  const actionTriggers = useRef(new Map<AssetId, HTMLButtonElement>());
  const [metadata, setMetadata] = useState<
    ReadonlyMap<AssetId, AssetPreviewMetadata>
  >(new Map());
  const [selectedAssetId, setSelectedAssetId] = useState<AssetId | undefined>(
    initialAsset?.id,
  );
  const selectedAsset =
    assets.find(({ id }) => id === selectedAssetId) ?? initialAsset;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredAssets = assets.filter(
    (asset) =>
      asset.name.toLocaleLowerCase().includes(normalizedQuery) &&
      (kindFilter === 'all' || asset.kind === kindFilter) &&
      (roleFilter === 'all' ||
        (asset.role !== undefined && assetRoleKey(asset.role) === roleFilter)),
  );
  const roles = [
    ...new Map(
      assets.flatMap((asset) =>
        asset.role === undefined
          ? []
          : [[assetRoleKey(asset.role), asset.role] as const],
      ),
    ),
  ];

  useEffect(() => {
    if (roleFilter !== 'all' && !roles.some(([key]) => key === roleFilter)) {
      setRoleFilter('all');
    }
  }, [roleFilter, roles]);

  function recordMetadata(assetId: AssetId, value: AssetPreviewMetadata): void {
    setMetadata((current) => {
      const next = new Map(current);
      next.set(assetId, value);
      return next;
    });
  }

  function metadataLabel(asset: Asset): string | undefined {
    const value = metadata.get(asset.id);
    if (value?.kind === 'image')
      return `${String(value.width)} × ${String(value.height)}`;
    if (value?.kind === 'audio') return formatDuration(value.durationSeconds);
    return undefined;
  }

  function usageLabel(asset: Asset): string | undefined {
    const occurrences = usageSummaries.get(asset.id)?.occurrences ?? 0;
    if (occurrences === 0) return undefined;
    return `${String(occurrences)} ${occurrences === 1 ? 'use' : 'uses'}`;
  }

  useEffect(() => {
    if (
      selectedAssetId !== undefined &&
      assets.some(({ id }) => id === selectedAssetId)
    ) {
      return;
    }
    setSelectedAssetId(initialAsset?.id);
  }, [assets, initialAsset?.id, selectedAssetId]);

  useEffect(() => {
    if (
      openActionsId !== null &&
      !filteredAssets.some(({ id }) => id === openActionsId)
    ) {
      setOpenActionsId(null);
    }
  }, [assets, kindFilter, openActionsId, query, roleFilter]);

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
    const values = filteredAssets.filter((asset) => asset.kind === kind);
    if (values.length === 0) return null;
    return (
      <section className="asset-library__group" role="group" aria-label={label}>
        <h2>
          {label} ({String(values.length)})
        </h2>
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
                    setOpenActionsId(null);
                    setSelectedAssetId(asset.id);
                  }}
                >
                  <span className="asset-preview">
                    <AssetPreview
                      asset={asset}
                      loadBlob={loadBlob}
                      createObjectUrl={createObjectUrl}
                      revokeObjectUrl={revokeObjectUrl}
                      onMetadata={(value) => {
                        recordMetadata(asset.id, value);
                      }}
                    />
                  </span>
                  <span className="asset-item__summary">
                    <strong>{asset.name}</strong>
                    <span>
                      {[metadataLabel(asset), formatBytes(asset.byteSize)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="asset-item__metadata-line">
                      <span className="asset-item__role">
                        {asset.role ?? 'No Role'}
                      </span>
                      {usageLabel(asset) === undefined ? null : (
                        <span>{usageLabel(asset)}</span>
                      )}
                    </span>
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
                      onMetadata={(value) => {
                        recordMetadata(asset.id, value);
                      }}
                    />
                  </span>
                  <button
                    className="asset-audio-row__select"
                    type="button"
                    aria-label={`Select ${asset.name}`}
                    aria-pressed={selectedAsset?.id === asset.id}
                    onClick={() => {
                      setOpenActionsId(null);
                      setSelectedAssetId(asset.id);
                    }}
                  >
                    <strong>{asset.name}</strong>
                    <span>
                      {[metadataLabel(asset), formatBytes(asset.byteSize)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="asset-item__metadata-line">
                      <span className="asset-item__role">
                        {asset.role ?? 'No Role'}
                      </span>
                      {usageLabel(asset) === undefined ? null : (
                        <span>{usageLabel(asset)}</span>
                      )}
                    </span>
                  </button>
                </>
              )}
              {selectedAsset?.id === asset.id ? null : (
                <div className="asset-item__overflow-anchor">
                  <Button
                    buttonRef={(node) => {
                      if (node === null)
                        actionTriggers.current.delete(asset.id);
                      else actionTriggers.current.set(asset.id, node);
                    }}
                    variant="quiet"
                    iconOnly
                    aria-label={`More actions for ${asset.name}`}
                    aria-expanded={openActionsId === asset.id}
                    data-asset-actions-id={asset.id}
                    onClick={() => {
                      setOpenActionsId((current) =>
                        current === asset.id ? null : asset.id,
                      );
                    }}
                  >
                    <Icon name="more" size={18} />
                  </Button>
                  {openActionsId !== asset.id ? null : (
                    <div className="asset-item__overflow">
                      <Button
                        variant="quiet"
                        aria-label={`Manage role for ${asset.name}`}
                        onClick={() => {
                          const trigger = actionTriggers.current.get(asset.id);
                          if (trigger === undefined) return;
                          setOpenActionsId(null);
                          openRoleDialog(asset, trigger);
                        }}
                      >
                        Manage Role
                      </Button>
                      <Button
                        variant="quiet"
                        aria-label={`Retire ${asset.name}`}
                        onClick={() => {
                          const trigger = actionTriggers.current.get(asset.id);
                          if (trigger === undefined) return;
                          setOpenActionsId(null);
                          openRetirementDialog(asset, trigger);
                        }}
                      >
                        Retire Asset
                      </Button>
                    </div>
                  )}
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
            '[data-retirement-asset-id], [data-asset-actions-id]',
          ) ?? [],
        ).find(
          ({ dataset }) =>
            dataset['retirementAssetId'] === target ||
            dataset['assetActionsId'] === target,
        );
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

      {assets.length === 0 ? null : (
        <div className="asset-library__toolbar">
          <label className="asset-library__search">
            <span className="visually-hidden">Search assets</span>
            <input
              type="search"
              aria-label="Search assets"
              placeholder="Search assets"
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
              }}
            />
          </label>
          <SegmentedControl<AssetKindFilter>
            label="Filter Assets by kind"
            value={kindFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'image', label: 'Images' },
              { value: 'audio', label: 'Audio' },
            ]}
            onChange={setKindFilter}
          />
          <Select
            label="Filter Assets by Role"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.currentTarget.value);
            }}
          >
            <option value="all">All roles</option>
            {roles.map(([key, role]) => (
              <option key={key} value={key}>
                {role}
              </option>
            ))}
          </Select>
        </div>
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
            {filteredAssets.length === 0 ? (
              <p>No Assets match these filters.</p>
            ) : null}
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
                <h2>{selectedAsset.name}</h2>
                <p>
                  {selectedAsset.kind === 'image' ? 'Image' : 'Audio'} ·{' '}
                  {formatBytes(selectedAsset.byteSize)}
                </p>
                <p>Role: {selectedAsset.role ?? 'No Role'}</p>
                {metadataLabel(selectedAsset) === undefined ? null : (
                  <p>{metadataLabel(selectedAsset)}</p>
                )}
              </div>
              {selectedAsset.kind === 'image' ? (
                <div className="asset-library__details-preview">
                  <AssetPreview
                    asset={selectedAsset}
                    loadBlob={loadBlob}
                    createObjectUrl={createObjectUrl}
                    revokeObjectUrl={revokeObjectUrl}
                    onMetadata={(value) => {
                      recordMetadata(selectedAsset.id, value);
                    }}
                  />
                </div>
              ) : null}
              {usageSummaries.get(selectedAsset.id) === undefined ? null : (
                <section
                  className="asset-library__usage"
                  aria-label="Asset usage"
                >
                  <h3>
                    Used in{' '}
                    {String(
                      usageSummaries.get(selectedAsset.id)?.workflowCount ?? 0,
                    )}{' '}
                    {(usageSummaries.get(selectedAsset.id)?.workflowCount ??
                      0) === 1
                      ? 'Workflow'
                      : 'Workflows'}
                  </h3>
                  <p>{usageLabel(selectedAsset) ?? '0 uses'}</p>
                  <ul>
                    {usageSummaries
                      .get(selectedAsset.id)
                      ?.workflows.map(({ id, name }) => (
                        <li key={id}>{name}</li>
                      ))}
                  </ul>
                </section>
              )}
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
