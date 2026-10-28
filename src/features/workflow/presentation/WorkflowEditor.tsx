import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import type { Asset, AssetId } from '@/features/assets';
import {
  AssetPicker,
  type AssetPickerUpload,
  type AssetPickerUploadSynchronization,
} from '@/features/assets/studio';
import { Button, Field, Select } from '@/shared';

import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';
import { RewardDiceEditor } from './RewardDiceEditor';
import { PhaseEnvironmentPreview } from './PhaseEnvironmentPreview';
import {
  useWorkflowEditor,
  validateWorkflowDraft,
  type AssetReferenceTransform,
  type WorkflowDraftErrors,
} from './useWorkflowEditor';
import { usePhaseDrag } from './usePhaseDrag';

export type WorkflowEditorProps = Readonly<{
  workflow?: Workflow;
  assetReferenceTransform?: AssetReferenceTransform;
  workflowId: string;
  assets: readonly Asset[];
  onSave(input: CreateWorkflowInput): Promise<void>;
  onUploadAsset?: AssetPickerUpload | undefined;
  onSynchronizeAssetUpload?: AssetPickerUploadSynchronization | undefined;
  loadAssetBlob?: ((id: AssetId) => Promise<Blob | null>) | undefined;
  createObjectUrl?: ((blob: Blob) => string) | undefined;
  revokeObjectUrl?: ((url: string) => void) | undefined;
}>;

const unavailableAssetBlob = () => Promise.resolve(null);
const unusedObjectUrl = () => '';
const ignoreObjectUrl = () => undefined;

export function WorkflowEditor({
  workflow,
  assetReferenceTransform,
  workflowId,
  assets,
  onSave,
  onUploadAsset,
  onSynchronizeAssetUpload,
  loadAssetBlob = unavailableAssetBlob,
  createObjectUrl = unusedObjectUrl,
  revokeObjectUrl = ignoreObjectUrl,
}: WorkflowEditorProps) {
  const editor = useWorkflowEditor(workflowId, workflow);
  const appliedAssetReferenceTransform = useRef(assetReferenceTransform);
  const [errors, setErrors] = useState<WorkflowDraftErrors>({});
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editorSection, setEditorSection] = useState<'phases' | 'reward'>(
    'phases',
  );
  const [phaseAnnouncement, setPhaseAnnouncement] = useState({
    id: 0,
    message: '',
  });
  const [collapsedPhaseKeys, setCollapsedPhaseKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [selectedPhaseKey, setSelectedPhaseKey] = useState(
    () => editor.draft.phases[0]?.key ?? '',
  );
  const saveStatusTimer = useRef<number | undefined>(undefined);
  const phaseListRef = useRef<HTMLOListElement>(null);
  const pendingMoveFocus = useRef<{
    phaseKey: string;
    direction: 'up' | 'down';
  } | null>(null);
  const moveButtons = useRef(new Map<string, HTMLButtonElement>());
  const phaseTabs = useRef(new Map<string, HTMLButtonElement>());
  const phaseDurationInputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (
      assetReferenceTransform !== undefined &&
      appliedAssetReferenceTransform.current !== assetReferenceTransform
    ) {
      editor.applyAssetReferenceTransform(assetReferenceTransform);
    }
    appliedAssetReferenceTransform.current = assetReferenceTransform;
  }, [assetReferenceTransform, editor]);

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
    setPhaseAnnouncement((current) => ({
      id: current.id + 1,
      message: `Moved ${name} to position ${String(targetIndex + 1)} of ${String(editor.draft.phases.length)}.`,
    }));
  }

  function handlePhaseTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    phaseKey: string,
  ): void {
    const current = editor.draft.phases.findIndex(
      ({ key }) => key === phaseKey,
    );
    let next: number | null = null;
    if (event.key === 'ArrowRight') {
      next = (current + 1) % editor.draft.phases.length;
    }
    if (event.key === 'ArrowLeft') {
      next =
        (current - 1 + editor.draft.phases.length) % editor.draft.phases.length;
    }
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = editor.draft.phases.length - 1;
    const phase = next === null ? undefined : editor.draft.phases[next];
    if (phase === undefined) return;
    event.preventDefault();
    setSelectedPhaseKey(phase.key);
    queueMicrotask(() => phaseTabs.current.get(phase.key)?.focus());
  }

  const phaseDrag = usePhaseDrag({
    phaseKeys: editor.draft.phases.map(({ key }) => key),
    listRef: phaseListRef,
    orientation: 'horizontal',
    onMove: movePhase,
    onCancel: () => {
      setPhaseAnnouncement((current) => ({
        id: current.id + 1,
        message: 'Phase move cancelled.',
      }));
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
    if (
      !editor.draft.phases.some(({ key }) => key === selectedPhaseKey) &&
      editor.draft.phases[0] !== undefined
    ) {
      setSelectedPhaseKey(editor.draft.phases[0].key);
    }
  }, [editor.draft.phases, selectedPhaseKey]);

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
        const firstInvalidPhaseKey = invalidPhaseKeys.values().next().value;
        if (firstInvalidPhaseKey !== undefined) {
          setSelectedPhaseKey(firstInvalidPhaseKey);
          setEditorSection('phases');
          queueMicrotask(() =>
            phaseDurationInputs.current.get(firstInvalidPhaseKey)?.focus(),
          );
        }
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
      if (
        invalidPhaseKeys.size === 0 &&
        Object.keys(validation.errors).some((key) => key.startsWith('reward'))
      ) {
        setEditorSection('reward');
      }
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

  const selectedPhaseIndex = Math.max(
    0,
    editor.draft.phases.findIndex(({ key }) => key === selectedPhaseKey),
  );
  const selectedPhase = editor.draft.phases[selectedPhaseIndex];

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

      <div className="editor-section-tabs" role="tablist" aria-label="Editor">
        <button
          id="editor-tab-phases"
          type="button"
          role="tab"
          aria-selected={editorSection === 'phases'}
          aria-controls="editor-panel-phases"
          tabIndex={editorSection === 'phases' ? 0 : -1}
          onClick={() => {
            setEditorSection('phases');
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'ArrowRight' ||
              event.key === 'ArrowLeft' ||
              event.key === 'End'
            ) {
              event.preventDefault();
              setEditorSection('reward');
              queueMicrotask(() =>
                document.getElementById('editor-tab-reward')?.focus(),
              );
            }
          }}
        >
          Phases
        </button>
        <button
          id="editor-tab-reward"
          type="button"
          role="tab"
          aria-selected={editorSection === 'reward'}
          aria-controls="editor-panel-reward"
          tabIndex={editorSection === 'reward' ? 0 : -1}
          onClick={() => {
            setEditorSection('reward');
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowRight' ||
              event.key === 'Home'
            ) {
              event.preventDefault();
              setEditorSection('phases');
              queueMicrotask(() =>
                document.getElementById('editor-tab-phases')?.focus(),
              );
            }
          }}
        >
          Reward Dice
        </button>
      </div>

      <section
        className="phase-editor"
        id="editor-panel-phases"
        role="tabpanel"
        aria-labelledby="editor-tab-phases"
        hidden={editorSection !== 'phases'}
      >
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
        <ol
          ref={phaseListRef}
          className="phase-sequence"
          aria-label="Phase sequence"
        >
          {editor.draft.phases.map((phase, index) => {
            const fallbackName = `Phase ${String(index + 1)}`;
            const displayName = phase.name.trim() || fallbackName;
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
                  className="phase-sequence__entry"
                  data-dragging={
                    phaseDrag.activePhaseKey === phase.key || undefined
                  }
                  ref={(node) => {
                    phaseDrag.registerPhase(phase.key, node);
                  }}
                >
                  <button
                    type="button"
                    className="phase-drag-handle"
                    tabIndex={-1}
                    aria-label={`Drag ${fallbackName}${displayName === fallbackName ? '' : `: ${displayName}`}`}
                    title={`Drag ${fallbackName}${displayName === fallbackName ? '' : `: ${displayName}`}`}
                    {...phaseDrag.getHandleProps(phase.key)}
                  >
                    ⠿
                  </button>
                  <button
                    ref={(node) => {
                      if (node === null) phaseTabs.current.delete(phase.key);
                      else phaseTabs.current.set(phase.key, node);
                    }}
                    type="button"
                    className="phase-sequence__item"
                    aria-label={`Select ${fallbackName}${displayName === fallbackName ? '' : `: ${displayName}`}`}
                    aria-pressed={phase.key === selectedPhaseKey}
                    tabIndex={phase.key === selectedPhaseKey ? 0 : -1}
                    onClick={() => {
                      setSelectedPhaseKey(phase.key);
                    }}
                    onKeyDown={(event) => {
                      handlePhaseTabKey(event, phase.key);
                    }}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{displayName}</strong>
                    <small>
                      {phase.durationMinutes} min ·{' '}
                      {phase.type === 'focus' ? 'Focus' : 'Break'}
                    </small>
                  </button>
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
        {selectedPhase === undefined ? null : (
          <PhaseEnvironmentPreview
            phaseName={selectedPhase.name}
            phasePosition={selectedPhaseIndex + 1}
            phaseType={selectedPhase.type}
            durationMinutes={selectedPhase.durationMinutes}
            backgroundColor={selectedPhase.backgroundColor}
            backgroundAsset={selectedPhase.backgroundAsset}
            audioAsset={selectedPhase.audioAsset}
            assets={assets}
            loadBlob={loadAssetBlob}
            createObjectUrl={createObjectUrl}
            revokeObjectUrl={revokeObjectUrl}
          />
        )}
        {selectedPhase === undefined
          ? null
          : (() => {
              const phase = selectedPhase;
              const index = selectedPhaseIndex;
              const fallbackName = `Phase ${String(index + 1)}`;
              const displayName = phase.name.trim() || fallbackName;
              const collapsed = collapsedPhaseKeys.has(phase.key);
              const contentId = `phase-${phase.key}-content`;
              return (
                <section
                  className="phase-settings"
                  aria-label={`${displayName} settings`}
                >
                  <div className="phase-item__header">
                    <h3>Basic</h3>
                    <div className="phase-item__actions">
                      <Button
                        variant="quiet"
                        aria-controls={contentId}
                        aria-expanded={!collapsed}
                        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${fallbackName}${displayName === fallbackName ? '' : `: ${displayName}`}`}
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
                  <div id={contentId} hidden={collapsed}>
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
                    <div className="form-grid phase-settings__basic">
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
                          ref={(node) => {
                            if (node === null)
                              phaseDurationInputs.current.delete(phase.key);
                            else
                              phaseDurationInputs.current.set(phase.key, node);
                          }}
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
                            )
                              return;
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
                    </div>
                    <section
                      className="phase-settings__environment"
                      aria-labelledby={`phase-${phase.key}-environment-title`}
                    >
                      <h3 id={`phase-${phase.key}-environment-title`}>
                        Environment
                      </h3>
                      <div className="form-grid">
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
                    </section>
                  </div>
                </section>
              );
            })()}
        <div className="visually-hidden" aria-live="polite">
          <span key={phaseAnnouncement.id}>{phaseAnnouncement.message}</span>
        </div>
      </section>

      <div
        id="editor-panel-reward"
        role="tabpanel"
        aria-labelledby="editor-tab-reward"
        hidden={editorSection !== 'reward'}
      >
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
      </div>
    </form>
  );
}
