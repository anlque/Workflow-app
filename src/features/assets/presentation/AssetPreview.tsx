import { useEffect, useState } from 'react';

import type { Asset, AssetId } from '../domain/Asset';

export type AssetPreviewProps = Readonly<{
  asset: Asset;
  loadBlob(id: AssetId): Promise<Blob | null>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
}>;

export function AssetPreview({
  asset,
  loadBlob,
  createObjectUrl,
  revokeObjectUrl,
}: AssetPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let ownedUrl: string | null = null;
    void loadBlob(asset.id).then((blob) => {
      if (!active) return;
      if (blob === null) {
        setUnavailable(true);
        return;
      }
      ownedUrl = createObjectUrl(blob);
      setUrl(ownedUrl);
    });
    return () => {
      active = false;
      if (ownedUrl !== null) revokeObjectUrl(ownedUrl);
    };
  }, [asset.id, createObjectUrl, loadBlob, revokeObjectUrl]);

  if (unavailable) {
    return <p className="asset-preview__empty">Preview unavailable</p>;
  }
  if (url === null) {
    return <p className="asset-preview__empty">Loading preview…</p>;
  }
  return asset.kind === 'image' ? (
    <img
      className="asset-preview__image"
      src={url}
      alt={`Preview of ${asset.name}`}
    />
  ) : (
    <audio
      className="asset-preview__audio"
      src={url}
      controls
      aria-label={`Preview ${asset.name}`}
    />
  );
}
