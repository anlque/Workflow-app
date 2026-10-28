import { useEffect, useRef, useState } from 'react';

import { assetRoleKey, type Asset, type AssetId } from '@/features/assets';

import type { AssetReference } from '../domain/Environment';

export type PhaseEnvironmentPreviewProps = Readonly<{
  phaseName: string;
  phasePosition: number;
  phaseType: 'focus' | 'break';
  durationMinutes: string;
  backgroundColor: string;
  backgroundAsset: AssetReference | undefined;
  audioAsset: AssetReference | undefined;
  assets: readonly Asset[];
  loadBlob(id: AssetId): Promise<Blob | null>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
}>;

function resolveAsset(
  reference: AssetReference | undefined,
  kind: Asset['kind'],
  assets: readonly Asset[],
): Asset | undefined {
  if (reference === undefined) return undefined;
  const asset =
    reference.type === 'direct'
      ? assets.find(({ id }) => id === reference.assetId)
      : assets.find(
          ({ role }) =>
            role !== undefined &&
            assetRoleKey(role) === assetRoleKey(reference.role),
        );
  return asset?.kind === kind ? asset : undefined;
}

export function PhaseEnvironmentPreview({
  phaseName,
  phasePosition,
  phaseType,
  durationMinutes,
  backgroundColor,
  backgroundAsset,
  audioAsset,
  assets,
  loadBlob,
  createObjectUrl,
  revokeObjectUrl,
}: PhaseEnvironmentPreviewProps) {
  const background = resolveAsset(backgroundAsset, 'image', assets);
  const ambient = resolveAsset(audioAsset, 'audio', assets);
  const backgroundReferenceKey =
    backgroundAsset === undefined
      ? 'none'
      : backgroundAsset.type === 'direct'
        ? `direct:${backgroundAsset.assetId}`
        : `role:${assetRoleKey(backgroundAsset.role)}`;
  const hasBackgroundReference = backgroundAsset !== undefined;
  const [url, setUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const callbacks = useRef({ loadBlob, createObjectUrl, revokeObjectUrl });
  callbacks.current = { loadBlob, createObjectUrl, revokeObjectUrl };

  useEffect(() => {
    let active = true;
    let ownedUrl: string | null = null;
    setUrl(null);
    setUnavailable(hasBackgroundReference && background === undefined);
    if (background === undefined) return () => undefined;
    const owner = callbacks.current;
    void owner.loadBlob(background.id).then(
      (blob) => {
        if (!active) return;
        if (blob === null) {
          setUnavailable(true);
          return;
        }
        ownedUrl = owner.createObjectUrl(blob);
        setUrl(ownedUrl);
      },
      () => {
        if (active) setUnavailable(true);
      },
    );
    return () => {
      active = false;
      if (ownedUrl !== null) owner.revokeObjectUrl(ownedUrl);
    };
  }, [background?.id, backgroundReferenceKey, hasBackgroundReference]);

  const label = phaseName.trim() || `Phase ${String(phasePosition)}`;
  const minutes = durationMinutes.trim() || '—';
  const style = backgroundColor.trim()
    ? { backgroundColor: backgroundColor.trim() }
    : undefined;

  return (
    <section
      className="phase-environment-preview"
      style={style}
      role="region"
      aria-label={`${label} preview`}
    >
      {url === null ? null : (
        <img
          className="phase-environment-preview__image"
          src={url}
          alt={background?.name ?? ''}
        />
      )}
      <div className="phase-environment-preview__scrim" aria-hidden="true" />
      <div className="phase-environment-preview__content">
        <span>Phase {String(phasePosition)}</span>
        <h3>{label}</h3>
        <p>
          {minutes} min · {phaseType === 'focus' ? 'Focus' : 'Break'}
        </p>
      </div>
      <div className="phase-environment-preview__meta">
        <span>{background?.name ?? 'Color background'}</span>
        <span>{ambient?.name ?? 'No ambient audio'}</span>
      </div>
      {unavailable ? (
        <p className="phase-environment-preview__fallback" role="status">
          Background preview unavailable
        </p>
      ) : null}
    </section>
  );
}
