import { useState, type ChangeEvent } from 'react';

import { Button, Dialog } from '@/shared';

import type { Asset, AssetId, AssetKind } from '../domain/Asset';
import { AssetPreview } from './AssetPreview';

export type AssetLibraryProps = Readonly<{
  assets: readonly Asset[];
  onImport(file: File, kind: AssetKind): Promise<void>;
  onDelete(id: AssetId): Promise<void>;
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
  onDelete,
  loadBlob,
  createObjectUrl,
  revokeObjectUrl,
}: AssetLibraryProps) {
  const [deleting, setDeleting] = useState<Asset | null>(null);
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

  async function remove(asset: Asset): Promise<void> {
    setPending(`delete:${asset.id}`);
    setError(null);
    try {
      await onDelete(asset.id);
      setDeleting(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Deletion failed.');
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="asset-library" aria-labelledby="asset-library-title">
      <header className="section-heading">
        <div>
          <h2 id="asset-library-title">Local Assets</h2>
          <p>Reusable images and ambient audio stored only in this browser.</p>
        </div>
        <label className="button button--primary asset-upload">
          {pending === 'import' ? 'Adding…' : 'Add asset'}
          <input
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
                </div>
                <Button
                  variant="quiet"
                  aria-label={`Delete ${asset.name}`}
                  onClick={() => {
                    setDeleting(asset);
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'Asset'}?`}
        onCancel={() => {
          setDeleting(null);
        }}
      >
        <p>Referenced Assets must be removed from every Workflow first.</p>
        {error === null ? null : (
          <p className="feedback feedback--error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button
            variant="quiet"
            onClick={() => {
              setDeleting(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={deleting !== null && pending === `delete:${deleting.id}`}
            pendingLabel="Deleting…"
            onClick={() => {
              if (deleting !== null) void remove(deleting);
            }}
          >
            Delete asset
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
