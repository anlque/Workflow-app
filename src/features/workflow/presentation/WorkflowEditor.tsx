import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { assetRoleKey, type Asset, type AssetId } from '@/features/assets';
import {
  AssetPreview,
  AssetPicker,
  type AssetPickerUpload,
  type AssetPickerUploadSynchronization,
} from '@/features/assets/studio';
import { Button, Field, Icon, Select, Switch } from '@/shared';

import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';
import type { AssetReference } from '../domain/Environment';
import { RewardDiceEditor } from './RewardDiceEditor';
import { PhaseEnvironmentPreview } from './PhaseEnvironmentPreview';
import {
  WorkflowEditorChromeActions,
  WorkflowEditorChromeIdentity,
  WorkflowEditorChromeStatus,
} from './WorkflowEditorChrome';
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

function resolvePhaseImage(
  reference: AssetReference | undefined,
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
  return asset?.kind === 'image' ? asset : undefined;
}

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
  const [openPhaseActionsKey, setOpenPhaseActionsKey] = useState<string | null>(
    null,
  );
  const [phaseActionsPosition, setPhaseActionsPosition] = useState({
    top: 0,
    left: 0,
  });
  const saveStatusTimer = useRef<number | undefined>(undefined);
  const phaseListRef = useRef<HTMLOListElement>(null);
  const phaseTabs = useRef(new Map<string, HTMLButtonElement>());
  const phaseDurationInputs = useRef(new Map<string, HTMLInputElement>());
  const phaseActionTriggers = useRef(new Map<string, HTMLButtonElement>());
  const phaseActionsMenu = useRef<HTMLDivElement>(null);

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
    setOpenPhaseActionsKey(null);
  }, [selectedPhaseKey]);

  useEffect(() => {
    if (openPhaseActionsKey !== null) {
      queueMicrotask(() =>
        phaseActionsMenu.current
          ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
          ?.focus(),
      );
    }
  }, [openPhaseActionsKey]);

  useLayoutEffect(() => {
    if (openPhaseActionsKey === null) return;
    const trigger = phaseActionTriggers.current.get(openPhaseActionsKey);
    const menu = phaseActionsMenu.current;
    if (trigger === undefined || menu === null) return;

    const updatePosition = () => {
      const triggerBounds = trigger.getBoundingClientRect();
      const menuBounds = menu.getBoundingClientRect();
      const gap = 4;
      const inset = 8;
      const preferredTop = triggerBounds.bottom + gap;
      const top =
        preferredTop + menuBounds.height <= window.innerHeight - inset
          ? preferredTop
          : Math.max(inset, triggerBounds.top - menuBounds.height - gap);
      const left = Math.min(
        Math.max(inset, triggerBounds.right - menuBounds.width),
        Math.max(inset, window.innerWidth - menuBounds.width - inset),
      );
      setPhaseActionsPosition({ top, left });
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menu.contains(target) &&
        !trigger.contains(target)
      ) {
        closePhaseActions(openPhaseActionsKey, false);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [openPhaseActionsKey]);

  useEffect(() => {
    if (
      openPhaseActionsKey !== null &&
      !editor.draft.phases.some(({ key }) => key === openPhaseActionsKey)
    ) {
      setOpenPhaseActionsKey(null);
    }
  }, [editor.draft.phases, openPhaseActionsKey]);

  function closePhaseActions(phaseKey: string, restoreFocus = true): void {
    setOpenPhaseActionsKey(null);
    if (restoreFocus) {
      queueMicrotask(() => phaseActionTriggers.current.get(phaseKey)?.focus());
    }
  }

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

  function renderPhaseActions(
    phase: (typeof editor.draft.phases)[number],
    index: number,
    fallbackName: string,
    displayName: string,
  ) {
    const collapsed = collapsedPhaseKeys.has(phase.key);
    const contentId = `phase-${phase.key}-content`;
    const contextualName = `${fallbackName}${displayName === fallbackName ? '' : `: ${displayName}`}`;
    return (
      <div className="phase-card__actions">
        <Button
          variant="quiet"
          buttonRef={(node) => {
            if (node === null) phaseActionTriggers.current.delete(phase.key);
            else phaseActionTriggers.current.set(phase.key, node);
          }}
          aria-label={`More actions for ${contextualName}`}
          aria-haspopup="menu"
          aria-expanded={openPhaseActionsKey === phase.key}
          onClick={() => {
            setOpenPhaseActionsKey((current) =>
              current === phase.key ? null : phase.key,
            );
          }}
        >
          <Icon name="more" size="1.25rem" />
        </Button>
        {openPhaseActionsKey === phase.key
          ? createPortal(
              <div
                ref={phaseActionsMenu}
                className="phase-actions-menu phase-actions-menu--portal"
                style={phaseActionsPosition}
                role="menu"
                aria-label={`Actions for ${contextualName}`}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closePhaseActions(phase.key);
                    return;
                  }
                  if (
                    event.key === 'ArrowDown' ||
                    event.key === 'ArrowUp' ||
                    event.key === 'Home' ||
                    event.key === 'End'
                  ) {
                    const items = Array.from(
                      event.currentTarget.querySelectorAll<HTMLButtonElement>(
                        '[role="menuitem"]:not(:disabled)',
                      ),
                    );
                    const current = items.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? items.length - 1
                          : event.key === 'ArrowDown'
                            ? (current + 1) % items.length
                            : (current - 1 + items.length) % items.length;
                    event.preventDefault();
                    items[next]?.focus();
                  }
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  aria-controls={contentId}
                  aria-expanded={!collapsed}
                  onClick={() => {
                    setCollapsedPhaseKeys((current) => {
                      const next = new Set(current);
                      if (next.has(phase.key)) next.delete(phase.key);
                      else next.add(phase.key);
                      return next;
                    });
                    closePhaseActions(phase.key);
                  }}
                >
                  {collapsed ? 'Expand' : 'Collapse'} {fallbackName}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={index === 0}
                  onClick={() => {
                    movePhase(phase.key, index - 1);
                    closePhaseActions(phase.key);
                  }}
                >
                  Move {fallbackName} up
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={index === editor.draft.phases.length - 1}
                  onClick={() => {
                    movePhase(phase.key, index + 1);
                    closePhaseActions(phase.key);
                  }}
                >
                  Move {fallbackName} down
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={editor.draft.phases.length === 1}
                  onClick={() => {
                    const nextFocusKey =
                      editor.draft.phases[index + 1]?.key ??
                      editor.draft.phases[index - 1]?.key;
                    setCollapsedPhaseKeys((current) => {
                      const next = new Set(current);
                      next.delete(phase.key);
                      return next;
                    });
                    editor.removePhase(phase.key);
                    setOpenPhaseActionsKey(null);
                    if (nextFocusKey !== undefined) {
                      queueMicrotask(() =>
                        phaseTabs.current.get(nextFocusKey)?.focus(),
                      );
                    }
                  }}
                >
                  Remove {fallbackName}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    editor.duplicatePhase(index);
                    closePhaseActions(phase.key);
                  }}
                >
                  Duplicate {fallbackName}
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  }

  const selectedPhaseIndex = Math.max(
    0,
    editor.draft.phases.findIndex(({ key }) => key === selectedPhaseKey),
  );
  const selectedPhase = editor.draft.phases[selectedPhaseIndex];
  const formId = `workflow-editor-${workflowId}`;

  return (
    <form
      id={formId}
      className="workflow-editor"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <WorkflowEditorChromeActions>
        <Button form={formId} type="submit" variant="primary" pending={pending}>
          Save workflow
        </Button>
      </WorkflowEditorChromeActions>
      <WorkflowEditorChromeStatus>
        {saved ? (
          <span className="editor-header__save-status" role="status">
            Workflow saved
          </span>
        ) : null}
      </WorkflowEditorChromeStatus>

      <p className="editor-introduction">
        Shape the sequence, atmosphere and optional reward ritual.
      </p>

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

      <WorkflowEditorChromeIdentity>
        <div className="workflow-editor-chrome__identity">
          <Field label="Workflow name" error={errors['name']}>
            <input
              form={formId}
              value={editor.draft.name}
              onChange={(event) => {
                editor.setName(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
            />
          </Field>
        </div>
      </WorkflowEditorChromeIdentity>

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
          <span>Reward Dice</span>
          <span
            className="editor-section-tabs__reward-status"
            aria-hidden="true"
          >
            · {editor.draft.rewardDice.enabled ? 'Enabled' : 'Disabled'}
          </span>
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
            <h2 id="phases-title">Phases</h2>
            <p>Run from top to bottom.</p>
          </div>
        </div>
        <div className="phase-sequence-layout">
          <div className="phase-sequence__add">
            <Button
              variant="secondary"
              onClick={() => {
                editor.addPhase();
              }}
            >
              <Icon name="plus" size="1.25rem" />
              <span>Add phase</span>
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
              const hasRewardMarker =
                editor.draft.rewardDice.enabled &&
                editor.rewardAfterPhaseKeys.includes(phase.key);
              const accessibleName = `Select ${fallbackName}${
                displayName === fallbackName ? '' : `: ${displayName}`
              } · ${phase.type === 'focus' ? 'Focus' : 'Break'} · ${
                phase.durationMinutes
              } min${hasRewardMarker ? ' · Reward after this phase' : ''}`;
              const thumbnailAsset = resolvePhaseImage(
                phase.backgroundAsset,
                assets,
              );
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
                    className="phase-sequence__entry phase-sequence__card"
                    data-selected={phase.key === selectedPhaseKey || undefined}
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
                      <Icon name="dragHandle" size="1.25rem" />
                    </button>
                    <button
                      ref={(node) => {
                        if (node === null) phaseTabs.current.delete(phase.key);
                        else phaseTabs.current.set(phase.key, node);
                      }}
                      type="button"
                      className="phase-sequence__item"
                      aria-label={accessibleName}
                      aria-pressed={phase.key === selectedPhaseKey}
                      tabIndex={phase.key === selectedPhaseKey ? 0 : -1}
                      onClick={() => {
                        setSelectedPhaseKey(phase.key);
                      }}
                      onKeyDown={(event) => {
                        handlePhaseTabKey(event, phase.key);
                      }}
                    >
                      <span
                        className="phase-sequence__thumbnail"
                        data-testid="phase-thumbnail"
                        aria-hidden="true"
                      >
                        {thumbnailAsset === undefined ? (
                          <span
                            className="phase-sequence__thumbnail-fallback"
                            style={
                              phase.backgroundColor.trim()
                                ? {
                                    backgroundColor:
                                      phase.backgroundColor.trim(),
                                  }
                                : undefined
                            }
                          />
                        ) : (
                          <AssetPreview
                            asset={thumbnailAsset}
                            loadBlob={loadAssetBlob}
                            createObjectUrl={createObjectUrl}
                            revokeObjectUrl={revokeObjectUrl}
                          />
                        )}
                      </span>
                      <span className="phase-sequence__type">
                        {String(index + 1).padStart(2, '0')} ·{' '}
                        {phase.type === 'focus' ? 'Focus' : 'Break'}
                      </span>
                      <strong>{displayName}</strong>
                      <small className="phase-sequence__duration">
                        {phase.durationMinutes} min
                      </small>
                      {hasRewardMarker ? (
                        <span
                          className="phase-sequence__reward-marker"
                          title="Reward after this phase"
                          aria-label="Reward after this phase"
                        >
                          <Icon name="reward" size="1rem" />
                        </span>
                      ) : null}
                    </button>
                    {renderPhaseActions(
                      phase,
                      index,
                      fallbackName,
                      displayName,
                    )}
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
        </div>
        {selectedPhase === undefined ? null : (
          <PhaseEnvironmentPreview
            phaseName={selectedPhase.name}
            phasePosition={selectedPhaseIndex + 1}
            totalPhases={editor.draft.phases.length}
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
                  <div
                    id={contentId}
                    className="phase-settings__cards"
                    hidden={collapsed}
                  >
                    <section
                      className="phase-settings__card phase-settings__card--basic"
                      aria-labelledby={`phase-${phase.key}-basic-title`}
                    >
                      <div className="phase-settings__card-heading">
                        <h3 id={`phase-${phase.key}-basic-title`}>
                          Basic settings
                        </h3>
                        <p>Name and timing for the selected phase.</p>
                      </div>
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
                        <Field
                          label={`Phase ${String(index + 1)} duration in minutes`}
                          error={errors[`phase:${phase.key}:duration`]}
                        >
                          <input
                            ref={(node) => {
                              if (node === null)
                                phaseDurationInputs.current.delete(phase.key);
                              else
                                phaseDurationInputs.current.set(
                                  phase.key,
                                  node,
                                );
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
                      </div>
                    </section>
                    <section
                      className="phase-settings__card phase-settings__card--environment phase-settings__environment"
                      aria-labelledby={`phase-${phase.key}-environment-title`}
                    >
                      <div className="phase-settings__card-heading">
                        <h3 id={`phase-${phase.key}-environment-title`}>
                          Environment settings
                        </h3>
                        <p>
                          Choose the visual and ambient mood for this phase.
                        </p>
                      </div>
                      <div className="phase-settings__environment-grid">
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
                        {editor.draft.rewardDice.enabled ? (
                          <div className="phase-settings__reward-toggle">
                            <Switch
                              label={`Reward after Phase ${String(index + 1)}`}
                              displayLabel={`Reward after Phase ${String(index + 1)}`}
                              description="Roll Reward Dice when this phase completes."
                              checked={editor.rewardAfterPhaseKeys.includes(
                                phase.key,
                              )}
                              onChange={() => {
                                editor.toggleRewardAfterPhase(phase.key);
                              }}
                            />
                          </div>
                        ) : null}
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
