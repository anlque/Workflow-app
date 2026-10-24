import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { Asset } from '@/features/assets';
import {
  AssetPicker,
  type AssetPickerUpload,
  type AssetPickerUploadSynchronization,
} from '@/features/assets/studio';
import { Button, Dialog, Field } from '@/shared';

import type { QuickWorkflow } from '../domain/QuickWorkflow';
import type { CreateWorkflowInput } from '../domain/Workflow';
import {
  useQuickWorkflowEditor,
  validateQuickWorkflowDraft,
  type QuickEnvironmentDraft,
} from './useQuickWorkflowEditor';

export type QuickWorkflowEditorProps = Readonly<{
  workflowId: string;
  workflow?: QuickWorkflow;
  assets: readonly Asset[];
  onSave(input: Extract<CreateWorkflowInput, { mode: 'quick' }>): Promise<void>;
  onConvert?(
    input: Extract<CreateWorkflowInput, { mode: 'quick' }>,
    keepQuickCopy: boolean,
  ): Promise<void>;
  onSynchronizeConversion?(): Promise<void>;
  onUploadAsset?: AssetPickerUpload;
  onSynchronizeAssetUpload?: AssetPickerUploadSynchronization;
  onDirtyChange?(dirty: boolean): void;
}>;

type PhaseKey = 'focus' | 'shortBreak' | 'longBreak';

export function QuickWorkflowEditor({
  workflowId,
  workflow,
  assets,
  onSave,
  onConvert,
  onSynchronizeConversion,
  onUploadAsset,
  onSynchronizeAssetUpload,
  onDirtyChange,
}: QuickWorkflowEditorProps) {
  const editor = useQuickWorkflowEditor(workflowId, workflow);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [keepQuickCopy, setKeepQuickCopy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionCommitted, setConversionCommitted] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const saveStatusTimer = useRef<number | undefined>(undefined);
  const rewardInputs = useRef(new Map<string, HTMLInputElement>());
  const [pendingRewardFocusKey, setPendingRewardFocusKey] = useState<
    string | null
  >(null);

  useEffect(() => onDirtyChange?.(editor.dirty), [editor.dirty, onDirtyChange]);

  function clearSavedStatus(): void {
    setSaved(false);
    if (saveStatusTimer.current !== undefined) {
      window.clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = undefined;
    }
  }

  useEffect(() => {
    clearSavedStatus();
  }, [editor.draft]);

  useEffect(() => {
    if (!drawerOpen || pendingRewardFocusKey === null) return;
    rewardInputs.current.get(pendingRewardFocusKey)?.focus();
    setPendingRewardFocusKey(null);
  }, [drawerOpen, pendingRewardFocusKey]);

  useEffect(
    () => () => {
      if (saveStatusTimer.current !== undefined) {
        window.clearTimeout(saveStatusTimer.current);
      }
    },
    [],
  );

  function setFieldError(key: string, message: string | null): void {
    setErrors((current) => {
      if (message !== null) return { ...current, [key]: message };
      return Object.fromEntries(
        Object.entries(current).filter(([currentKey]) => currentKey !== key),
      );
    });
  }

  function updatePhase(phase: PhaseKey, patch: Partial<QuickEnvironmentDraft>) {
    editor.updatePhase(phase, patch);
  }

  function durationKey(phase: PhaseKey) {
    return `${phase}:duration`;
  }

  function handleDurationKey(
    event: KeyboardEvent<HTMLInputElement>,
    phase: PhaseKey,
  ) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const valid = editor.stepDuration(phase, event.key === 'ArrowUp' ? 1 : -1);
    setFieldError(
      durationKey(phase),
      valid
        ? null
        : 'Duration must be at least 0.5 minutes in 0.5-minute increments.',
    );
  }

  function phaseFields(phase: PhaseKey, label: string) {
    const value = editor.draft[phase];
    return (
      <div className="quick-setup__section-fields">
        <Field
          label={`${label} duration in minutes`}
          error={errors[durationKey(phase)]}
        >
          <input
            type="text"
            inputMode="decimal"
            value={value.durationMinutes}
            onChange={(event) => {
              updatePhase(phase, { durationMinutes: event.target.value });
            }}
            onBlur={() => {
              const valid = editor.commitDuration(phase);
              setFieldError(
                durationKey(phase),
                valid
                  ? null
                  : 'Duration must be at least 0.5 minutes in 0.5-minute increments.',
              );
            }}
            onKeyDown={(event) => {
              handleDurationKey(event, phase);
            }}
          />
        </Field>
        <AssetPicker
          label={`${label} background image`}
          kind="image"
          assets={assets}
          value={value.backgroundAsset}
          onChange={(backgroundAsset) => {
            updatePhase(phase, { backgroundAsset });
          }}
          onUpload={onUploadAsset}
          onSynchronizeUpload={onSynchronizeAssetUpload}
        />
        <AssetPicker
          label={`${label} ambient audio`}
          kind="audio"
          assets={assets}
          value={value.audioAsset}
          onChange={(audioAsset) => {
            updatePhase(phase, { audioAsset });
          }}
          onUpload={onUploadAsset}
          onSynchronizeUpload={onSynchronizeAssetUpload}
        />
        <Field label={`${label} background color`} hint="Optional CSS color.">
          <input
            value={value.backgroundColor}
            onChange={(event) => {
              updatePhase(phase, { backgroundColor: event.target.value });
            }}
          />
        </Field>
      </div>
    );
  }

  async function save() {
    const result = validateQuickWorkflowDraft(editor.draft);
    if (!result.valid) {
      setErrors(result.errors);
      const rewardErrorKey = Object.keys(result.errors).find((key) =>
        /^reward:[^:]+:(icon|title|weight)$/u.test(key),
      );
      if (rewardErrorKey !== undefined) {
        setPendingRewardFocusKey(rewardErrorKey);
        setDrawerOpen(true);
      }
      return;
    }
    setErrors({});
    setSaveError(null);
    setSaving(true);
    try {
      await onSave(result.input);
      editor.markSaved();
      clearSavedStatus();
      setSaved(true);
      saveStatusTimer.current = window.setTimeout(() => {
        setSaved(false);
        saveStatusTimer.current = undefined;
      }, 3_000);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Saving failed.');
    } finally {
      setSaving(false);
    }
  }

  async function convert() {
    if (onConvert === undefined || onSynchronizeConversion === undefined)
      return;
    setConversionError(null);
    setConverting(true);
    try {
      if (!conversionCommitted) {
        const result = validateQuickWorkflowDraft(editor.draft);
        if (!result.valid) {
          setErrors(result.errors);
          setConversionError(
            'Review the highlighted fields before converting.',
          );
          return;
        }
        setErrors({});
        await onConvert(result.input, keepQuickCopy);
        setConversionCommitted(true);
      }
      await onSynchronizeConversion();
      setConversionOpen(false);
    } catch (cause) {
      setConversionError(
        cause instanceof Error ? cause.message : 'Conversion failed.',
      );
    } finally {
      setConverting(false);
    }
  }

  return (
    <form
      className="quick-setup"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className="editor-header">
        <div>
          <h2>Quick setup</h2>
          <p>
            Individual Phases and advanced Reward settings are available after
            conversion to Detailed setup.
          </p>
        </div>
        <div className="editor-header__save">
          {saved ? (
            <span className="editor-header__save-status" role="status">
              Workflow saved
            </span>
          ) : null}
          {workflow === undefined || onConvert === undefined ? null : (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setConversionError(null);
                setKeepQuickCopy(false);
                setConversionOpen(true);
              }}
            >
              Convert to detailed
            </Button>
          )}
          <Button
            variant="primary"
            type="submit"
            pending={saving}
            pendingLabel="Saving…"
          >
            Save workflow
          </Button>
        </div>
      </header>
      {Object.keys(errors).length === 0 ? null : (
        <p className="feedback feedback--error" role="alert">
          Review the highlighted fields before saving.
        </p>
      )}
      {saveError === null ? null : (
        <p className="feedback feedback--error" role="alert">
          {saveError}
        </p>
      )}
      <div className="form-grid">
        <Field label="Workflow name" error={errors['name']}>
          <input
            value={editor.draft.name}
            onChange={(event) => {
              editor.setName(event.target.value);
            }}
          />
        </Field>
        <Field label="Cycles" error={errors['cycleCount']}>
          <input
            type="number"
            min={1}
            max={20}
            value={editor.draft.cycleCount}
            onChange={(event) => {
              editor.setCycleCount(event.target.value);
            }}
          />
        </Field>
      </div>

      <section
        className="quick-setup__section"
        aria-labelledby="quick-focus-title"
      >
        <h3 id="quick-focus-title">Focus</h3>
        {phaseFields('focus', 'Focus')}
      </section>
      <section
        className="quick-setup__section"
        aria-labelledby="quick-short-break-title"
      >
        <h3 id="quick-short-break-title">Short Break</h3>
        {phaseFields('shortBreak', 'Short Break')}
      </section>
      <section
        className="quick-setup__section"
        aria-labelledby="quick-long-break-title"
      >
        <h3 id="quick-long-break-title">Long Break</h3>
        <label className="check-control">
          <input
            type="checkbox"
            checked={editor.draft.longBreak.enabled}
            onChange={(event) => {
              editor.setDraft((current) => ({
                ...current,
                longBreak: {
                  ...current.longBreak,
                  enabled: event.target.checked,
                },
              }));
            }}
          />
          Use Long Break
        </label>
        {editor.draft.longBreak.enabled ? (
          <>
            <Field
              label="Long Break every N cycles"
              error={errors['longBreak:frequency']}
            >
              <input
                type="number"
                min={1}
                max={20}
                value={editor.draft.longBreak.frequency}
                onChange={(event) => {
                  editor.setDraft((current) => ({
                    ...current,
                    longBreak: {
                      ...current.longBreak,
                      frequency: event.target.value,
                    },
                  }));
                }}
              />
            </Field>
            {phaseFields('longBreak', 'Long Break')}
          </>
        ) : null}
      </section>

      <section
        className="quick-setup__section"
        aria-labelledby="quick-reward-title"
      >
        <h3 id="quick-reward-title">Reward Dice</h3>
        <label className="check-control">
          <input
            type="checkbox"
            checked={editor.draft.rewardDice.enabled}
            onChange={(event) => {
              editor.setDraft((current) => ({
                ...current,
                rewardDice: {
                  ...current.rewardDice,
                  enabled: event.target.checked,
                },
              }));
            }}
          />
          Use Reward Dice
        </label>
        {editor.draft.rewardDice.enabled ? (
          <div className="quick-setup__reward-controls">
            <Field
              label="Reward every N cycles"
              error={errors['reward:frequency']}
            >
              <input
                type="number"
                min={1}
                max={20}
                value={editor.draft.rewardDice.frequency}
                onChange={(event) => {
                  editor.setDraft((current) => ({
                    ...current,
                    rewardDice: {
                      ...current.rewardDice,
                      frequency: event.target.value,
                    },
                  }));
                }}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDrawerOpen(true);
              }}
            >
              Configure sides
            </Button>
            {errors['reward:sides'] === undefined ? null : (
              <p className="field__error">{errors['reward:sides']}</p>
            )}
          </div>
        ) : null}
      </section>

      <Dialog
        open={drawerOpen}
        className="quick-reward-drawer"
        title="Reward sides drawer"
        onCancel={() => {
          setDrawerOpen(false);
        }}
      >
        <div className="quick-reward-drawer__sides">
          {editor.draft.rewardDice.sides.map((side, index) => (
            <fieldset className="quick-reward-side" key={side.key}>
              <legend>Reward side {String(index + 1)}</legend>
              <Field
                label={`Reward side ${String(index + 1)} icon`}
                error={errors[`reward:${side.key}:icon`]}
              >
                <input
                  ref={(element) => {
                    const key = `reward:${side.key}:icon`;
                    if (element === null) rewardInputs.current.delete(key);
                    else rewardInputs.current.set(key, element);
                  }}
                  value={side.icon}
                  onChange={(event) => {
                    editor.setDraft((current) => ({
                      ...current,
                      rewardDice: {
                        ...current.rewardDice,
                        sides: current.rewardDice.sides.map((value) =>
                          value.key === side.key
                            ? { ...value, icon: event.target.value }
                            : value,
                        ),
                      },
                    }));
                  }}
                />
              </Field>
              <Field
                label={`Reward side ${String(index + 1)} title`}
                error={errors[`reward:${side.key}:title`]}
              >
                <input
                  ref={(element) => {
                    const key = `reward:${side.key}:title`;
                    if (element === null) rewardInputs.current.delete(key);
                    else rewardInputs.current.set(key, element);
                  }}
                  value={side.title}
                  onChange={(event) => {
                    editor.setDraft((current) => ({
                      ...current,
                      rewardDice: {
                        ...current.rewardDice,
                        sides: current.rewardDice.sides.map((value) =>
                          value.key === side.key
                            ? { ...value, title: event.target.value }
                            : value,
                        ),
                      },
                    }));
                  }}
                />
              </Field>
              <Field
                label={`Reward side ${String(index + 1)} weight`}
                hint="Optional when all sides are equal."
                error={errors[`reward:${side.key}:weight`]}
              >
                <input
                  ref={(element) => {
                    const key = `reward:${side.key}:weight`;
                    if (element === null) rewardInputs.current.delete(key);
                    else rewardInputs.current.set(key, element);
                  }}
                  inputMode="decimal"
                  value={side.weight}
                  onChange={(event) => {
                    editor.setDraft((current) => ({
                      ...current,
                      rewardDice: {
                        ...current.rewardDice,
                        sides: current.rewardDice.sides.map((value) =>
                          value.key === side.key
                            ? { ...value, weight: event.target.value }
                            : value,
                        ),
                      },
                    }));
                  }}
                />
              </Field>
              <Button
                type="button"
                variant="quiet"
                disabled={editor.draft.rewardDice.sides.length <= 2}
                aria-label={`Remove Reward side ${String(index + 1)}`}
                onClick={() => {
                  editor.setDraft((current) => ({
                    ...current,
                    rewardDice: {
                      ...current.rewardDice,
                      sides: current.rewardDice.sides.filter(
                        (value) => value.key !== side.key,
                      ),
                    },
                  }));
                }}
              >
                Remove
              </Button>
            </fieldset>
          ))}
        </div>
        <div className="dialog__actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              editor.setDraft((current) => ({
                ...current,
                rewardDice: {
                  ...current.rewardDice,
                  sides: [
                    ...current.rewardDice.sides,
                    {
                      key: crypto.randomUUID(),
                      icon: '',
                      title: '',
                      weight: '',
                    },
                  ],
                },
              }));
            }}
          >
            Add side
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setDrawerOpen(false);
            }}
          >
            Done
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={conversionOpen}
        title="Convert to Detailed setup?"
        describedBy="quick-conversion-warning"
        onCancel={() => {
          if (!converting && !conversionCommitted) setConversionOpen(false);
        }}
      >
        <p id="quick-conversion-warning">
          This Workflow cannot be converted back to Quick Setup. Its current
          Phases, Environments and Reward behavior will be preserved.
        </p>
        {conversionCommitted ? null : (
          <label className="check-control">
            <input
              type="checkbox"
              checked={keepQuickCopy}
              onChange={(event) => {
                setKeepQuickCopy(event.target.checked);
              }}
            />
            Keep a Quick copy
          </label>
        )}
        {conversionError === null ? null : (
          <p className="feedback feedback--error" role="alert">
            {conversionError}
          </p>
        )}
        <div className="dialog__actions">
          {conversionCommitted ? null : (
            <Button
              type="button"
              variant="secondary"
              disabled={converting}
              onClick={() => {
                setConversionOpen(false);
              }}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            pending={converting}
            pendingLabel={
              conversionCommitted ? 'Synchronizing…' : 'Converting…'
            }
            onClick={() => {
              void convert();
            }}
          >
            {conversionCommitted
              ? 'Retry sync'
              : editor.dirty
                ? 'Save and convert'
                : 'Convert'}
          </Button>
        </div>
      </Dialog>
    </form>
  );
}
