import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Dialog, Field } from '@/shared';

import type { Asset, AssetId } from '../domain/Asset';
import type {
  AssetRetirementChoice,
  AssetRetirementPreview,
} from '../application/AssetRetirement';
import type { ImportAssetInput } from '../application/importAssetUseCase';
import { StaleAssetRetirementError } from '../application/AssetRetirementErrors';

export type AssetRetirementDialogProps = Readonly<{
  asset: Asset;
  assets: readonly Asset[];
  onInspect(id: AssetId): Promise<AssetRetirementPreview>;
  onRetire(
    preview: AssetRetirementPreview,
    choice: AssetRetirementChoice,
  ): Promise<void>;
  onSynchronize(): Promise<void>;
  createUploadInput(file: File, kind: Asset['kind']): ImportAssetInput;
  onCancel(): void;
  onSuccess(choice: AssetRetirementChoice): void;
}>;

export function AssetRetirementDialog({
  asset,
  assets,
  onInspect,
  onRetire,
  onSynchronize,
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
  const [committedChoice, setCommittedChoice] =
    useState<AssetRetirementChoice | null>(null);
  const [focusTarget, setFocusTarget] = useState<
    'continue' | 'choices' | 'review' | null
  >(null);
  const inFlight = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const firstChoiceRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (focusTarget === 'continue') continueRef.current?.focus();
    if (focusTarget === 'choices') firstChoiceRef.current?.focus();
    if (focusTarget === 'review') reviewRef.current?.focus();
    if (focusTarget !== null) setFocusTarget(null);
  }, [focusTarget]);

  async function inspect(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      setPreview(await onInspect(asset.id));
      setFocusTarget('continue');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Asset review failed.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function synchronize(committed: AssetRetirementChoice): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onSynchronize();
      onSuccess(committed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Catalog synchronization failed.',
      );
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
      setCommittedChoice(retirementChoice);
      inFlight.current = false;
      setPending(false);
      await synchronize(retirementChoice);
    } catch (cause) {
      if (cause instanceof StaleAssetRetirementError) {
        setPreview(null);
        setStep(1);
        setFocusTarget('review');
      }
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
      (total, usage) => total + usage.occurrences.length,
      0,
    ) ?? 0;
  const canRemove =
    preview?.usages.every(({ occurrences }) =>
      occurrences.every(({ optional }) => optional),
    ) ?? false;

  return (
    <Dialog
      open
      title={`Retire ${asset.name}`}
      describedBy="asset-retirement-description"
      onCancel={() => {
        if (!inFlight.current && committedChoice === null) onCancel();
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
                      {usage.workflowName}:{' '}
                      {
                        usage.occurrences.filter(
                          ({ referenceMode }) => referenceMode === 'direct',
                        ).length
                      }{' '}
                      direct,{' '}
                      {
                        usage.occurrences.filter(
                          ({ referenceMode }) => referenceMode === 'role',
                        ).length
                      }{' '}
                      by Role
                      <ul>
                        {usage.occurrences.map((occurrence) => (
                          <li
                            key={`${String(occurrence.phaseIndex)}:${occurrence.location}:${occurrence.referenceMode}`}
                          >
                            Phase {String(occurrence.phaseIndex + 1)} ·{' '}
                            {occurrence.location} · {occurrence.referenceMode} ·{' '}
                            {occurrence.optional ? 'optional' : 'required'}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
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
                buttonRef={reviewRef}
                pending={pending}
                pendingLabel="Reviewing…"
                onClick={() => void inspect()}
              >
                Review usage
              </Button>
            ) : (
              <Button
                key="continue"
                buttonRef={continueRef}
                onClick={() => {
                  setStep(2);
                  setFocusTarget('choices');
                }}
              >
                Continue
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <fieldset
            className="asset-retirement__choices"
            disabled={pending || committedChoice !== null}
          >
            <legend>Resolve references</legend>
            <label className="asset-retirement__choice">
              <input
                ref={firstChoiceRef}
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
          {asset.role === undefined ? null : choice === 'remove' ? (
            <p>Role “{asset.role}” will be retired with this Asset.</p>
          ) : (
            <p>Role “{asset.role}” will move to the replacement.</p>
          )}
          {error === null ? null : (
            <p className="feedback feedback--error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog__actions">
            {committedChoice === null ? (
              <>
                <Button
                  variant="quiet"
                  disabled={pending}
                  onClick={() => {
                    setStep(1);
                    setFocusTarget('continue');
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
              </>
            ) : (
              <Button
                pending={pending}
                pendingLabel="Synchronizing…"
                onClick={() => void synchronize(committedChoice)}
              >
                Retry sync
              </Button>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
