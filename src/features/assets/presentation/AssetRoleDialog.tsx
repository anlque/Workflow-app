import { useEffect, useRef, useState } from 'react';

import { Button, Dialog, Field } from '@/shared';

import type { Asset } from '../domain/Asset';
import type { AssetRoleChangePreview } from '../application/AssetRoleChange';

export type AssetRoleDialogProps = Readonly<{
  asset: Asset;
  onInspect(
    assetId: Asset['id'],
    value: string,
  ): Promise<AssetRoleChangePreview>;
  onApply(preview: AssetRoleChangePreview): Promise<void>;
  onCancel(): void;
  onSuccess(): void;
}>;

function actionLabel(action: AssetRoleChangePreview['action']): string {
  if (action === 'move') return 'Move role';
  if (action === 'rename') return 'Rename role';
  if (action === 'unchanged') return 'Done';
  return 'Assign role';
}

export function AssetRoleDialog({
  asset,
  onInspect,
  onApply,
  onCancel,
  onSuccess,
}: AssetRoleDialogProps) {
  const [value, setValue] = useState(asset.role ?? '');
  const [preview, setPreview] = useState<AssetRoleChangePreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error !== null && preview === null) inputRef.current?.focus();
  }, [error, preview]);

  async function inspect(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      setPreview(await onInspect(asset.id, value));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Role review failed.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function apply(): Promise<void> {
    if (inFlight.current || preview === null) return;
    if (preview.action === 'unchanged') {
      onSuccess();
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onApply(preview);
      onSuccess();
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : 'Role change failed.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      title={`Manage Role for ${asset.name}`}
      describedBy="asset-role-description"
      onCancel={() => {
        if (!inFlight.current) onCancel();
      }}
    >
      <p id="asset-role-description">
        A Role is a stable alias. Workflows that follow it use whichever Asset
        currently owns it.
      </p>
      {preview === null ? (
        <Field
          label="Role"
          hint="One globally unique Role, up to 64 characters."
          error={error ?? undefined}
        >
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </Field>
      ) : (
        <div aria-live="polite">
          {preview.action === 'move' ? (
            <p>
              Role <strong>{preview.role}</strong> currently belongs to{' '}
              {preview.currentOwner?.name}. Moving it affects{' '}
              {preview.affectedWorkflowCount}{' '}
              {preview.affectedWorkflowCount === 1 ? 'Workflow' : 'Workflows'}.
            </p>
          ) : preview.action === 'rename' ? (
            <p>
              Renaming this Role affects {preview.affectedWorkflowCount}{' '}
              {preview.affectedWorkflowCount === 1 ? 'Workflow' : 'Workflows'}.
            </p>
          ) : (
            <p>
              {preview.action === 'create'
                ? `Assign Role ${preview.role} to ${asset.name}.`
                : 'This Role is already assigned.'}
            </p>
          )}
          {preview.action === 'move' &&
          preview.expectedKinds.some((kind) => kind !== asset.kind) ? (
            <p className="feedback feedback--warning">
              This move changes Asset kind for some Workflow uses and may
              prevent a future Session from starting.
            </p>
          ) : null}
        </div>
      )}
      <div className="dialog__actions">
        <Button variant="quiet" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        {preview === null ? (
          <Button
            pending={pending}
            pendingLabel="Reviewing…"
            onClick={() => void inspect()}
          >
            Review role
          </Button>
        ) : (
          <Button
            pending={pending}
            pendingLabel="Applying…"
            onClick={() => void apply()}
          >
            {actionLabel(preview.action)}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
