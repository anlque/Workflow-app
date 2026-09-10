import { useMemo, useRef, useState } from 'react';

import { Button, Dialog, Field } from '@/shared';

import type { Asset, AssetId } from '../domain/Asset';
import type {
  AssetRetirementChoice,
  AssetRetirementPreview,
} from '../application/AssetRetirement';
import type { ImportAssetInput } from '../application/importAssetUseCase';

export type AssetRetirementDialogProps = Readonly<{
  asset: Asset;
  assets: readonly Asset[];
  onInspect(id: AssetId): Promise<AssetRetirementPreview>;
  onRetire(
    preview: AssetRetirementPreview,
    choice: AssetRetirementChoice,
  ): Promise<void>;
  createUploadInput(file: File, kind: Asset['kind']): ImportAssetInput;
  onCancel(): void;
  onSuccess(): void;
}>;

export function AssetRetirementDialog({
  asset,
  assets,
  onInspect,
  onRetire,
  createUploadInput,
  onCancel,
  onSuccess,
}: AssetRetirementDialogProps) {
  const [preview, setPreview] = useState<AssetRetirementPreview | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<'existing' | 'upload' | 'remove'>(
    'existing',
  );
  const [replacementId, setReplacementId] = useState('');
  const [upload, setUpload] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const candidates = useMemo(
    () =>
      assets.filter(
        (candidate) =>
          candidate.id !== asset.id &&
          candidate.kind === asset.kind &&
          (asset.role === undefined || candidate.role === undefined),
      ),
    [asset, assets],
  );

  async function inspect(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      setPreview(await onInspect(asset.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Asset review failed.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function retire(): Promise<void> {
    if (inFlight.current || preview === null) return;
    let retirementChoice: AssetRetirementChoice;
    if (choice === 'remove') retirementChoice = { type: 'remove' };
    else if (choice === 'upload') {
      if (upload === null) {
        setError('Choose a replacement file.');
        return;
      }
      retirementChoice = {
        type: 'upload',
        input: createUploadInput(upload, asset.kind),
      };
    } else {
      const selected = candidates.find(({ id }) => id === replacementId);
      if (selected === undefined) {
        setError('Choose a replacement Asset.');
        return;
      }
      retirementChoice = { type: 'existing', assetId: selected.id };
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onRetire(preview, retirementChoice);
      onSuccess();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Asset retirement failed.',
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const totalReferences =
    preview?.usages.reduce(
      (total, usage) =>
        total + usage.directReferenceCount + usage.roleReferenceCount,
      0,
    ) ?? 0;
  const canRemove =
    preview?.usages.every(
      ({ requiredReferenceCount }) => requiredReferenceCount === 0,
    ) ?? false;

  return (
    <Dialog
      open
      title={`Retire ${asset.name}`}
      describedBy="asset-retirement-description"
      onCancel={() => {
        if (!inFlight.current) onCancel();
      }}
    >
      <p id="asset-retirement-description">
        Review every Workflow reference, then replace or remove it atomically.
      </p>
      {step === 1 ? (
        <>
          {preview === null ? (
            <p>No changes are made during this review.</p>
          ) : (
            <div aria-live="polite">
              <p>
                {totalReferences}{' '}
                {totalReferences === 1 ? 'reference' : 'references'} in{' '}
                {preview.usages.length}{' '}
                {preview.usages.length === 1 ? 'Workflow' : 'Workflows'}.
              </p>
              {preview.usages.length === 0 ? null : (
                <ul>
                  {preview.usages.map((usage) => (
                    <li key={usage.workflowId}>
                      {usage.workflowName}: {usage.directReferenceCount} direct,{' '}
                      {usage.roleReferenceCount} by Role
                    </li>
                  ))}
                </ul>
              )}
              {asset.role === undefined ? null : (
                <p>Role “{asset.role}” will move to the replacement.</p>
              )}
            </div>
          )}
          {error === null ? null : (
            <p className="feedback feedback--error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog__actions">
            <Button
              autoFocus
              variant="quiet"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
            {preview === null ? (
              <Button
                pending={pending}
                pendingLabel="Reviewing…"
                onClick={() => void inspect()}
              >
                Review usage
              </Button>
            ) : (
              <Button
                key="continue"
                onClick={() => {
                  setStep(2);
                }}
              >
                Continue
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <fieldset className="asset-retirement__choices">
            <legend>Resolve references</legend>
            <label className="asset-retirement__choice">
              <input
                type="radio"
                name="retirement-choice"
                checked={choice === 'existing'}
                onChange={() => {
                  setChoice('existing');
                }}
              />
              Use an existing Asset
            </label>
            {choice === 'existing' ? (
              <Field label="Replacement Asset">
                <select
                  value={replacementId}
                  onChange={(event) => {
                    setReplacementId(event.target.value);
                  }}
                >
                  <option value="">Choose an Asset</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <label className="asset-retirement__choice">
              <input
                type="radio"
                name="retirement-choice"
                checked={choice === 'upload'}
                onChange={() => {
                  setChoice('upload');
                }}
              />
              Upload a replacement
            </label>
            {choice === 'upload' ? (
              <Field label="Replacement file">
                <input
                  type="file"
                  accept={
                    asset.kind === 'image'
                      ? 'image/png,image/jpeg,image/webp'
                      : 'audio/mpeg,audio/ogg,audio/wav'
                  }
                  onChange={(event) => {
                    setUpload(event.target.files?.[0] ?? null);
                  }}
                />
              </Field>
            ) : null}
            <label className="asset-retirement__choice">
              <input
                type="radio"
                name="retirement-choice"
                checked={choice === 'remove'}
                disabled={!canRemove}
                onChange={() => {
                  setChoice('remove');
                }}
              />
              Remove optional references
            </label>
            {canRemove ? null : (
              <p>Required references need a replacement Asset.</p>
            )}
          </fieldset>
          {error === null ? null : (
            <p className="feedback feedback--error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog__actions">
            <Button
              variant="quiet"
              disabled={pending}
              onClick={() => {
                setStep(1);
              }}
            >
              Back
            </Button>
            <Button
              key="retire"
              variant="danger"
              pending={pending}
              pendingLabel="Retiring…"
              onClick={() => void retire()}
            >
              Retire asset
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
