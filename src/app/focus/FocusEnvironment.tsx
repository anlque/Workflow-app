import { useEffect, useState } from 'react';

import type { AssetId } from '@/features/assets';
import type { Environment } from '@/features/workflow';
import { Button } from '@/shared';

import {
  useAmbientAudio,
  type AmbientAudioDeviceChanges,
} from './useAmbientAudio';

export type FocusEnvironmentProps = Readonly<{
  environment: Environment;
  reducedMotion: boolean;
  playing: boolean;
  volume: number;
  deviceChanges?: AmbientAudioDeviceChanges | null;
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
  playing,
  volume,
  deviceChanges,
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
  const ambientAudio = useAmbientAudio({
    sourceUrl: audio.url,
    playing,
    volume,
    ...(deviceChanges === undefined ? {} : { deviceChanges }),
  });

  return (
    <>
      <div
        className="focus-environment"
        data-testid="focus-environment"
        data-reduced-motion={String(reducedMotion)}
        style={{ backgroundColor: environment.backgroundColor }}
      >
        {image.url === null ? null : <img src={image.url} alt="" />}
        {ambientAudio.sourceUrl === null ? null : (
          <audio
            ref={ambientAudio.audioRef}
            src={ambientAudio.sourceUrl}
            loop
            hidden
            aria-hidden="true"
          />
        )}
      </div>
      <div className="focus-environment__controls">
        {ambientAudio.state === 'blocked' ? (
          <Button
            variant="secondary"
            onClick={() => void ambientAudio.enable()}
          >
            Enable audio
          </Button>
        ) : null}
        {ambientAudio.state === 'recovery-blocked' ? (
          <Button
            variant="secondary"
            onClick={() => void ambientAudio.resume()}
          >
            Resume audio
          </Button>
        ) : null}
        {image.unavailable || audio.unavailable ? (
          <p className="focus-environment__status" role="status">
            A focus environment asset is unavailable.
          </p>
        ) : null}
      </div>
    </>
  );
}
