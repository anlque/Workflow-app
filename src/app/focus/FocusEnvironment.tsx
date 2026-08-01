import { useEffect, useRef, useState } from 'react';

import type { AssetId } from '@/features/assets';
import type { Environment } from '@/features/workflow';

export type FocusEnvironmentProps = Readonly<{
  environment: Environment;
  reducedMotion: boolean;
  loadAssetUrl(id: AssetId): Promise<string | null>;
  releaseAssetUrl(url: string): void;
}>;

function useAssetUrl(
  id: AssetId | undefined,
  load: (id: AssetId) => Promise<string | null>,
  release: (url: string) => void,
): Readonly<{ url: string | null; unavailable: boolean }> {
  const [url, setUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let acquiredUrl: string | null = null;
    setUrl(null);
    setUnavailable(false);
    if (id === undefined) return;
    void load(id).then(
      (value) => {
        if (value === null) {
          if (active) setUnavailable(true);
          return;
        }
        acquiredUrl = value;
        if (active) setUrl(value);
        else release(value);
      },
      () => {
        if (active) setUnavailable(true);
      },
    );
    return () => {
      active = false;
      if (acquiredUrl !== null) release(acquiredUrl);
    };
  }, [id, load, release]);

  return { url, unavailable };
}

export function FocusEnvironment({
  environment,
  reducedMotion,
  loadAssetUrl,
  releaseAssetUrl,
}: FocusEnvironmentProps) {
  const image = useAssetUrl(
    environment.backgroundAssetId,
    loadAssetUrl,
    releaseAssetUrl,
  );
  const audio = useAssetUrl(
    environment.audioAssetId,
    loadAssetUrl,
    releaseAssetUrl,
  );
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(
    () => () => {
      const element = audioRef.current;
      if (element !== null && !element.paused) element.pause();
    },
    [audio.url],
  );

  return (
    <div
      className="focus-environment"
      data-testid="focus-environment"
      data-reduced-motion={String(reducedMotion)}
      style={{ backgroundColor: environment.backgroundColor }}
    >
      {image.url === null ? null : <img src={image.url} alt="" />}
      {audio.url === null ? null : (
        <audio
          ref={audioRef}
          src={audio.url}
          controls
          loop
          aria-label="Ambient audio"
        />
      )}
      {image.unavailable || audio.unavailable ? (
        <p className="focus-environment__status" role="status">
          A focus environment asset is unavailable.
        </p>
      ) : null}
    </div>
  );
}
