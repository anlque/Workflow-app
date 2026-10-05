import { Fragment, useEffect, useRef, useState } from 'react';

import type { Asset } from '@/features/assets';
import {
  AssetPicker,
  type AssetPickerUpload,
  type AssetPickerUploadSynchronization,
} from '@/features/assets/studio';
import { Button, Field, Select } from '@/shared';

import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';
import { RewardDiceEditor } from './RewardDiceEditor';
import {
  useWorkflowEditor,
  validateWorkflowDraft,
  type WorkflowDraftErrors,
} from './useWorkflowEditor';
import { usePhaseDrag } from './usePhaseDrag';

export type WorkflowEditorProps = Readonly<{
  workflow?: Workflow;
  workflowId: string;
  assets: readonly Asset[];
  onSave(input: CreateWorkflowInput): Promise<void>;
  onUploadAsset?: AssetPickerUpload | undefined;
  onSynchronizeAssetUpload?: AssetPickerUploadSynchronization | undefined;
}>;

export function WorkflowEditor({
  workflow,
  workflowId,
  assets,
  onSave,
  onUploadAsset,
  onSynchronizeAssetUpload,
}: WorkflowEditorProps) {
  const editor = useWorkflowEditor(workflowId, workflow);
  const [errors, setErrors] = useState<WorkflowDraftErrors>({});
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [phaseAnnouncement, setPhaseAnnouncement] = useState('');
  const [collapsedPhaseKeys, setCollapsedPhaseKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const saveStatusTimer = useRef<number | undefined>(undefined);
  const phaseListRef = useRef<HTMLOListElement>(null);
  const pendingMoveFocus = useRef<{
    phaseKey: string;
    direction: 'up' | 'down';
  } | null>(null);
  const moveButtons = useRef(new Map<string, HTMLButtonElement>());

  function phaseName(phaseKey: string): string {
    const index = editor.draft.phases.findIndex(({ key }) => key === phaseKey);
    const phase = editor.draft.phases[index];
    const name = phase?.name.trim();
    return name === undefined || name.length === 0
      ? `Phase ${String(index + 1)}`
      : name;
  }

  function movePhase(phaseKey: string, targetIndex: number): void {
    const sourceIndex = editor.draft.phases.findIndex(
      ({ key }) => key === phaseKey,
    );
    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= editor.draft.phases.length ||
      sourceIndex === targetIndex
    ) {
      return;
    }
    const name = phaseName(phaseKey);
    editor.movePhaseTo(phaseKey, targetIndex);
    setPhaseAnnouncement(
      `Moved ${name} to position ${String(targetIndex + 1)} of ${String(editor.draft.phases.length)}.`,
    );
  }

  const phaseDrag = usePhaseDrag({
    phaseKeys: editor.draft.phases.map(({ key }) => key),
    listRef: phaseListRef,
    onMove: movePhase,
    onCancel: () => {
      setPhaseAnnouncement('Phase move cancelled.');
    },
  });
  const remainingDragKeys = editor.draft.phases
    .map(({ key }) => key)
    .filter((key) => key !== phaseDrag.activePhaseKey);
  const targetKey =
    phaseDrag.targetIndex === null
      ? undefined
      : remainingDragKeys[phaseDrag.targetIndex];
  const dropGapIndex =
    phaseDrag.targetIndex === null
      ? null
      : targetKey === undefined
        ? editor.draft.phases.length
        : editor.draft.phases.findIndex(({ key }) => key === targetKey);

  function setDurationError(errorKey: string, invalid: boolean): void {
    setErrors((current) => {
      if (invalid) {
        return {
          ...current,
          [errorKey]:
            'Duration must be at least 0.5 minutes in 0.5-minute increments.',
        };
      }
      return Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== errorKey),
      );
    });
  }

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
    const pending = pendingMoveFocus.current;
    if (pending === null) return;
    pendingMoveFocus.current = null;
    const index = editor.draft.phases.findIndex(
      ({ key }) => key === pending.phaseKey,
    );
    const preferred =
      pending.direction === 'up'
        ? index > 0
          ? 'up'
          : 'down'
        : index < editor.draft.phases.length - 1
          ? 'down'
          : 'up';
    moveButtons.current.get(`${pending.phaseKey}:${preferred}`)?.focus();
  }, [editor.draft.phases]);

  useEffect(
    () => () => {
      if (saveStatusTimer.current !== undefined) {
        window.clearTimeout(saveStatusTimer.current);
      }
    },
    [],
  );

  async function save(): Promise<void> {
    const validation = validateWorkflowDraft(editor.draft);
    if (!validation.valid) {
      const invalidPhaseKeys = new Set(
        Object.keys(validation.errors).flatMap((errorKey) => {
          const match = /^phase:([^:]+):/.exec(errorKey);
          return match?.[1] === undefined ? [] : [match[1]];
        }),
      );
      if (invalidPhaseKeys.size > 0) {
        setCollapsedPhaseKeys(
          (current) =>
            new Set(
              [...current].filter(
                (phaseKey) => !invalidPhaseKeys.has(phaseKey),
              ),
            ),
        );
      }
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setSaveError(null);
    clearSavedStatus();
    setPending(true);
    try {
      await onSave(validation.input);
      setSaved(true);
      saveStatusTimer.current = window.setTimeout(() => {
        setSaved(false);
        saveStatusTimer.current = undefined;
      }, 3_000);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Saving failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="workflow-editor"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className="editor-header">
        <div>
          <h2>{workflow === undefined ? 'New Workflow' : workflow.name}</h2>
          <p>Shape the sequence, atmosphere and optional reward ritual.</p>
        </div>
        <div className="editor-header__save">
          {saved ? (
            <span className="editor-header__save-status" role="status">
              Workflow saved
            </span>
          ) : null}
          <Button type="submit" variant="primary" pending={pending}>
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

      <Field label="Workflow name" error={errors['name']}>
        <input
          value={editor.draft.name}
          onChange={(event) => {
            editor.setName(event.target.value);
          }}
        />
      </Field>

      <section className="phase-editor" aria-labelledby="phases-title">
        <div className="section-heading">
          <div>
            <h3 id="phases-title">Phases</h3>
            <p>Run from top to bottom.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              editor.addPhase();
            }}
          >
            Add phase
          </Button>
        </div>
        <ol ref={phaseListRef} className="phase-list">
          {editor.draft.phases.map((phase, index) => {
            const fallbackName = `Phase ${String(index + 1)}`;
            const displayName = phase.name.trim() || fallbackName;
            const collapsed = collapsedPhaseKeys.has(phase.key);
            const contentId = `phase-${phase.key}-content`;
            const disclosureTargetName =
              displayName === fallbackName
                ? fallbackName
                : `${fallbackName}: ${displayName}`;
            return (
              <Fragment key={phase.key}>
                {dropGapIndex === index ? (
                  <li
                    className="phase-drop-indicator"
                    data-testid="phase-drop-indicator"
                    aria-hidden="true"
                  />
                ) : null}
                <li
                  className="phase-item"
                  data-dragging={
                    phaseDrag.activePhaseKey === phase.key || undefined
                  }
                  ref={(node) => {
                    phaseDrag.registerPhase(phase.key, node);
                  }}
                >
                  <div className="phase-item__header">
                    <span
                      className="phase-drag-handle"
                      role="img"
                      tabIndex={-1}
                      aria-label={`Drag ${disclosureTargetName}`}
                      title={`Drag ${disclosureTargetName}`}
                      {...phaseDrag.getHandleProps(phase.key)}
                    >
                      ⠿
                    </span>
                    <h4>{displayName}</h4>
                    <div className="phase-item__actions">
                      <Button
                        variant="quiet"
                        aria-controls={contentId}
                        aria-expanded={!collapsed}
                        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${disclosureTargetName}`}
                        onClick={() => {
                          setCollapsedPhaseKeys((current) => {
                            const next = new Set(current);
                            if (next.has(phase.key)) next.delete(phase.key);
                            else next.add(phase.key);
                            return next;
                          });
                        }}
                      >
                        {collapsed ? 'Expand' : 'Collapse'}
                      </Button>
                      <Button
                        variant="quiet"
                        buttonRef={(node) => {
                          const key = `${phase.key}:up`;
                          if (node === null) moveButtons.current.delete(key);
                          else moveButtons.current.set(key, node);
                        }}
                        aria-label={`Move Phase ${String(index + 1)} up`}
                        disabled={index === 0}
                        onClick={() => {
                          pendingMoveFocus.current = {
                            phaseKey: phase.key,
                            direction: 'up',
                          };
                          movePhase(phase.key, index - 1);
                        }}
                      >
                        Move up
                      </Button>
                      <Button
                        variant="quiet"
                        buttonRef={(node) => {
                          const key = `${phase.key}:down`;
                          if (node === null) moveButtons.current.delete(key);
                          else moveButtons.current.set(key, node);
                        }}
                        aria-label={`Move Phase ${String(index + 1)} down`}
                        disabled={index === editor.draft.phases.length - 1}
                        onClick={() => {
                          pendingMoveFocus.current = {
                            phaseKey: phase.key,
                            direction: 'down',
                          };
                          movePhase(phase.key, index + 1);
                        }}
                      >
                        Move down
                      </Button>
                      <Button
                        variant="quiet"
                        aria-label={`Remove Phase ${String(index + 1)}`}
                        disabled={editor.draft.phases.length === 1}
                        onClick={() => {
                          setCollapsedPhaseKeys((current) => {
                            const next = new Set(current);
                            next.delete(phase.key);
                            return next;
                          });
                          editor.removePhase(phase.key);
                        }}
                      >
                        Remove
                      </Button>
                      <Button
                        variant="quiet"
                        aria-label={`Duplicate Phase ${String(index + 1)}`}
                        onClick={() => {
                          editor.duplicatePhase(index);
                        }}
                      >
                        Duplicate
                      </Button>
                    </div>
                  </div>
                  <div
                    className="phase-item__content"
                    id={contentId}
                    hidden={collapsed}
                  >
                    {editor.draft.rewardDice.enabled ? (
                      <label className="check-control">
                        <input
                          type="checkbox"
                          checked={editor.rewardAfterPhaseKeys.includes(
                            phase.key,
                          )}
                          onChange={() => {
                            editor.toggleRewardAfterPhase(phase.key);
                          }}
                        />
                        Reward after Phase {String(index + 1)}
                      </label>
                    ) : null}
                    <div className="form-grid">
                      <Field label={`${fallbackName} name`} hint="Optional.">
                        <input
                          value={phase.name}
                          onChange={(event) => {
                            editor.updatePhase(phase.key, {
                              name: event.target.value,
                            });
                          }}
                        />
                      </Field>
                      <Select
                        label={`Phase ${String(index + 1)} type`}
                        value={phase.type}
                        onChange={(event) => {
                          editor.updatePhase(phase.key, {
                            type:
                              event.target.value === 'break'
                                ? 'break'
                                : 'focus',
                          });
                        }}
                      >
                        <option value="focus">Focus</option>
                        <option value="break">Break</option>
                      </Select>
                      <Field
                        label={`Phase ${String(index + 1)} duration in minutes`}
                        error={errors[`phase:${phase.key}:duration`]}
                      >
                        <input
                          inputMode="decimal"
                          type="text"
                          value={phase.durationMinutes}
                          onChange={(event) => {
                            setDurationError(
                              `phase:${phase.key}:duration`,
                              false,
                            );
                            editor.updatePhase(phase.key, {
                              durationMinutes: event.target.value,
                            });
                          }}
                          onBlur={() => {
                            setDurationError(
                              `phase:${phase.key}:duration`,
                              !editor.commitPhaseDuration(phase.key),
                            );
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.key !== 'ArrowUp' &&
                              event.key !== 'ArrowDown'
                            ) {
                              return;
                            }
                            event.preventDefault();
                            setDurationError(
                              `phase:${phase.key}:duration`,
                              !editor.stepPhaseDuration(
                                phase.key,
                                event.key === 'ArrowUp' ? 1 : -1,
                              ),
                            );
                          }}
                        />
                      </Field>
                      <AssetPicker
                        label="Background image"
                        kind="image"
                        assets={assets}
                        value={phase.backgroundAsset}
                        onChange={(backgroundAsset) => {
                          editor.updatePhase(phase.key, { backgroundAsset });
                        }}
                        onUpload={onUploadAsset}
                        onSynchronizeUpload={onSynchronizeAssetUpload}
                      />
                      <AssetPicker
                        label="Ambient audio"
                        kind="audio"
                        assets={assets}
                        value={phase.audioAsset}
                        onChange={(audioAsset) => {
                          editor.updatePhase(phase.key, { audioAsset });
                        }}
                        onUpload={onUploadAsset}
                        onSynchronizeUpload={onSynchronizeAssetUpload}
                      />
                      <Field
                        label="Background color"
                        hint="Optional CSS color."
                      >
                        <input
                          value={phase.backgroundColor}
                          placeholder="#18342b"
                          onChange={(event) => {
                            editor.updatePhase(phase.key, {
                              backgroundColor: event.target.value,
                            });
                          }}
                        />
                      </Field>
                    </div>
                  </div>
                </li>
              </Fragment>
            );
          })}
          {dropGapIndex === editor.draft.phases.length ? (
            <li
              className="phase-drop-indicator"
              data-testid="phase-drop-indicator"
              aria-hidden="true"
            />
          ) : null}
        </ol>
        <div className="visually-hidden" aria-live="polite">
          {phaseAnnouncement}
        </div>
      </section>

      <RewardDiceEditor
        assets={assets}
        onUploadAsset={onUploadAsset}
        onSynchronizeAssetUpload={onSynchronizeAssetUpload}
        draft={editor.draft.rewardDice}
        errors={errors}
        onEnabledChange={(enabled) => {
          editor.setRewardEnabled(enabled);
        }}
        onScheduleModeChange={(scheduleMode) => {
          editor.setRewardScheduleMode(scheduleMode);
        }}
        onTriggerPhaseTypeChange={(triggerPhaseType) => {
          editor.setRewardTriggerPhaseType(triggerPhaseType);
        }}
        onFrequencyChange={(frequency) => {
          editor.setRewardFrequency(frequency);
        }}
        onRerollsChange={(rerolls) => {
          editor.setRewardRerolls(rerolls);
        }}
        onSideChange={(key, side) => {
          editor.updateRewardSide(key, side);
        }}
        onBonusDurationChange={(sideKey, durationMinutes) => {
          setDurationError(`reward:${sideKey}:bonus:duration`, false);
          const bonusPhase = editor.draft.rewardDice.sides.find(
            ({ key }) => key === sideKey,
          )?.bonusPhase;
          if (bonusPhase !== undefined) {
            editor.updateRewardSide(sideKey, {
              bonusPhase: { ...bonusPhase, durationMinutes },
            });
          }
        }}
        onBonusDurationCommit={(sideKey) => {
          setDurationError(
            `reward:${sideKey}:bonus:duration`,
            !editor.commitBonusDuration(sideKey),
          );
        }}
        onBonusDurationStep={(sideKey, direction) => {
          setDurationError(
            `reward:${sideKey}:bonus:duration`,
            !editor.stepBonusDuration(sideKey, direction),
          );
        }}
        onAddSide={() => {
          editor.addRewardSide();
        }}
        onRemoveSide={(key) => {
          editor.removeRewardSide(key);
        }}
      />
    </form>
  );
}
