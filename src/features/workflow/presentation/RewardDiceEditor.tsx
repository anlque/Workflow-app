import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Button, Field, SegmentedControl, Switch } from '@/shared';
import type { Asset } from '@/features/assets';
import {
  AssetPicker,
  type AssetPickerUpload,
  type AssetPickerUploadSynchronization,
} from '@/features/assets/studio';

import type { RewardPhaseType } from '../domain/RewardDice';
import type { DiceSideAvailability } from '../domain/DiceSide';

import type {
  RewardDiceDraft,
  RewardSideDraft,
  WorkflowDraftErrors,
} from './useWorkflowEditor';
import { formatRewardWeightPresentation } from './rewardWeightPresentation';

export type RewardDiceEditorProps = Readonly<{
  assets: readonly Asset[];
  draft: RewardDiceDraft;
  errors: WorkflowDraftErrors;
  onUploadAsset?: AssetPickerUpload | undefined;
  onSynchronizeAssetUpload?: AssetPickerUploadSynchronization | undefined;
  onEnabledChange(enabled: boolean): void;
  onScheduleModeChange(value: 'frequency' | 'custom'): void;
  onTriggerPhaseTypeChange(value: RewardPhaseType): void;
  onFrequencyChange(value: string): void;
  onRerollsChange(value: string): void;
  onSideChange(key: string, patch: Partial<RewardSideDraft>): void;
  onBonusDurationChange(key: string, value: string): void;
  onBonusDurationCommit(key: string): void;
  onBonusDurationStep(key: string, direction: -1 | 1): void;
  onAddSide(): void;
  onRemoveSide(key: string): void;
}>;

function availabilityLabel(value: DiceSideAvailability): string {
  return value === 'early' ? 'Early' : value === 'late' ? 'Late' : 'Any';
}

function splitWeightPresentation(value: string): Readonly<{
  weight: string;
  chance?: string;
}> {
  const separator = value.lastIndexOf(' · ');
  if (separator < 0) return { weight: value };
  return {
    weight: value.slice(0, separator),
    chance: value.slice(separator + 3),
  };
}

export function RewardDiceEditor({
  draft,
  assets,
  errors,
  onUploadAsset,
  onSynchronizeAssetUpload,
  onEnabledChange,
  onScheduleModeChange,
  onTriggerPhaseTypeChange,
  onFrequencyChange,
  onRerollsChange,
  onSideChange,
  onBonusDurationChange,
  onBonusDurationCommit,
  onBonusDurationStep,
  onAddSide,
  onRemoveSide,
}: RewardDiceEditorProps) {
  const removalDisabled = draft.sides.length <= 2;
  const removalHintId = 'reward-dice-side-removal-hint';
  const [selectedSideKey, setSelectedSideKey] = useState(
    () => draft.sides[0]?.key ?? '',
  );
  const activeSideKey = draft.sides.some(({ key }) => key === selectedSideKey)
    ? selectedSideKey
    : (draft.sides[0]?.key ?? '');
  const sideTabs = useRef(new Map<string, HTMLButtonElement>());
  const weightPresentation = formatRewardWeightPresentation(
    draft.sides.map(({ weight }) => weight),
  );

  useEffect(() => {
    if (!draft.sides.some(({ key }) => key === selectedSideKey)) {
      setSelectedSideKey(draft.sides[0]?.key ?? '');
    }
  }, [draft.sides, selectedSideKey]);

  useEffect(() => {
    const invalidSide = draft.sides.find(({ key }) =>
      Object.keys(errors).some((errorKey) =>
        errorKey.startsWith(`reward:${key}:`),
      ),
    );
    if (invalidSide !== undefined) setSelectedSideKey(invalidSide.key);
  }, [draft.sides, errors]);

  function handleSideKey(
    event: KeyboardEvent<HTMLButtonElement>,
    sideKey: string,
  ): void {
    const current = draft.sides.findIndex(({ key }) => key === sideKey);
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (current + 1) % draft.sides.length;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (current - 1 + draft.sides.length) % draft.sides.length;
    }
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = draft.sides.length - 1;
    const side = next === null ? undefined : draft.sides[next];
    if (side === undefined) return;
    event.preventDefault();
    setSelectedSideKey(side.key);
    queueMicrotask(() => sideTabs.current.get(side.key)?.focus());
  }

  return (
    <section className="reward-editor" aria-labelledby="reward-dice-title">
      <fieldset className="reward-editor__configuration">
        <legend className="visually-hidden">Reward configuration</legend>
        <div className="reward-editor__configuration-header">
          <div>
            <h3 id="reward-dice-title">Reward Dice</h3>
            <p>Configure when rewards appear and what each side offers.</p>
          </div>
          <div className="reward-editor__configuration-controls">
            <Switch
              label="Enable Reward Dice"
              displayLabel="Enabled"
              checked={draft.enabled}
              onChange={onEnabledChange}
            />
            <SegmentedControl
              label="Reward schedule"
              value={draft.scheduleMode}
              disabled={!draft.enabled}
              options={[
                { value: 'frequency', label: 'Frequency' },
                { value: 'custom', label: 'Custom' },
              ]}
              onChange={onScheduleModeChange}
            />
          </div>
        </div>
        {draft.enabled ? (
          <div className="reward-editor__configuration-fields">
            {draft.scheduleMode === 'frequency' ? (
              <>
                <Field label="Reward after">
                  <select
                    className="select"
                    value={draft.triggerPhaseType}
                    onChange={(event) => {
                      onTriggerPhaseTypeChange(
                        event.target.value as RewardPhaseType,
                      );
                    }}
                  >
                    <option value="focus">Focus phases</option>
                    <option value="break">Break phases</option>
                  </select>
                </Field>
                <Field
                  label="Reward frequency"
                  hint={`Completed ${draft.triggerPhaseType} phases between rolls.`}
                  error={errors['reward:frequency']}
                >
                  <input
                    inputMode="numeric"
                    value={draft.frequency}
                    onChange={(event) => {
                      onFrequencyChange(event.target.value);
                    }}
                  />
                </Field>
              </>
            ) : (
              <>
                <p className="field__hint">
                  Choose Reward markers in the Phase list.
                </p>
                {errors['reward:schedule'] === undefined ? null : (
                  <p className="field__error" role="alert">
                    {errors['reward:schedule']}
                  </p>
                )}
              </>
            )}
            <Field
              label="Available rerolls"
              hint="Additional rolls available after the first roll."
              error={errors['reward:rerolls']}
            >
              <select
                className="select"
                value={draft.rerolls}
                onChange={(event) => {
                  onRerollsChange(event.target.value);
                }}
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </Field>
            {errors['reward:sides'] === undefined ? null : (
              <p className="field__error" role="alert">
                {errors['reward:sides']}
              </p>
            )}
          </div>
        ) : null}
      </fieldset>
      {draft.enabled ? (
        <div className="reward-editor__side-layout">
          <section
            className="reward-editor__sides-card"
            aria-label="Dice sides"
          >
            <div className="reward-editor__card-heading">
              <div>
                <h3>Dice sides</h3>
                {weightPresentation.summary === null ? null : (
                  <p>{weightPresentation.summary}</p>
                )}
              </div>
              <Button variant="secondary" onClick={onAddSide}>
                Add reward side
              </Button>
            </div>
            <ol className="reward-side-list" aria-label="Reward sides">
              {draft.sides.map((side, index) => {
                const presentation = splitWeightPresentation(
                  weightPresentation.sides[index] ?? '',
                );
                return (
                  <li
                    key={side.key}
                    aria-label={`Reward side ${String(index + 1)}`}
                  >
                    <button
                      ref={(node) => {
                        if (node === null) sideTabs.current.delete(side.key);
                        else sideTabs.current.set(side.key, node);
                      }}
                      type="button"
                      className="reward-side-list__item"
                      aria-label={`Select reward side ${String(index + 1)}: ${side.title.trim() || `Side ${String(index + 1)}`}`}
                      aria-pressed={activeSideKey === side.key}
                      tabIndex={activeSideKey === side.key ? 0 : -1}
                      onClick={() => {
                        setSelectedSideKey(side.key);
                      }}
                      onKeyDown={(event) => {
                        handleSideKey(event, side.key);
                      }}
                    >
                      <span className="reward-side-list__icon">
                        {side.icon || '•'}
                      </span>
                      <span className="reward-side-list__copy">
                        <strong>
                          {side.title.trim() || `Side ${String(index + 1)}`}
                        </strong>
                        <small>
                          {side.description.trim() || 'No description'}
                        </small>
                      </span>
                      <span className="reward-side-list__availability">
                        {availabilityLabel(side.availability)}
                      </span>
                      <span className="reward-side-list__weight">
                        {presentation.weight}
                      </span>
                      {presentation.chance === undefined ? null : (
                        <span className="reward-side-list__chance">
                          {presentation.chance}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
            {removalDisabled ? (
              <p className="field__hint" id={removalHintId}>
                A Reward Dice needs at least two sides.
              </p>
            ) : null}
          </section>
          <section
            className="reward-side-editor"
            aria-label="Selected reward side"
          >
            <ol className="reward-sides">
              {draft.sides
                .filter(({ key }) => key === activeSideKey)
                .map((side) => {
                  const index = draft.sides.findIndex(
                    ({ key }) => key === side.key,
                  );
                  const bonusPhase = side.bonusPhase ?? {
                    enabled: false,
                    name: '',
                    durationMinutes: '5',
                    backgroundAsset: undefined,
                    audioAsset: undefined,
                    backgroundColor: '',
                  };
                  const updateBonus = (
                    patch: Partial<typeof bonusPhase>,
                  ): void => {
                    onSideChange(side.key, {
                      bonusPhase: { ...bonusPhase, ...patch },
                    });
                  };
                  return (
                    <li key={side.key} className="reward-side">
                      <div className="reward-editor__card-heading">
                        <div>
                          <h3>Selected side</h3>
                          <p>
                            Side {String(index + 1)} of{' '}
                            {String(draft.sides.length)}
                          </p>
                        </div>
                        <Button
                          variant="quiet"
                          aria-label={`Remove reward side ${String(index + 1)}`}
                          aria-describedby={
                            removalDisabled ? removalHintId : undefined
                          }
                          disabled={removalDisabled}
                          onClick={() => {
                            onRemoveSide(side.key);
                          }}
                        >
                          Remove side
                        </Button>
                      </div>
                      <div className="reward-side-preview">
                        <span className="reward-side-preview__icon">
                          {side.icon || '•'}
                        </span>
                        <span className="reward-side-preview__copy">
                          <strong>
                            {side.title.trim() || `Side ${String(index + 1)}`}
                          </strong>
                          <span>
                            {side.description.trim() ||
                              'Add a short description for this reward.'}
                          </span>
                          <small>
                            {availabilityLabel(side.availability)} ·{' '}
                            {weightPresentation.sides[index]}
                          </small>
                        </span>
                      </div>
                      <div className="reward-side__fields">
                        <Field
                          label={`Reward side ${String(index + 1)} title`}
                          error={errors[`reward:${side.key}:title`]}
                        >
                          <input
                            value={side.title}
                            onChange={(event) => {
                              onSideChange(side.key, {
                                title: event.target.value,
                              });
                            }}
                          />
                        </Field>
                        <Field
                          label={`Reward side ${String(index + 1)} icon`}
                          error={errors[`reward:${side.key}:icon`]}
                        >
                          <input
                            value={side.icon}
                            onChange={(event) => {
                              onSideChange(side.key, {
                                icon: event.target.value,
                              });
                            }}
                          />
                        </Field>
                        <Field
                          label={`Reward side ${String(index + 1)} description`}
                        >
                          <input
                            value={side.description}
                            onChange={(event) => {
                              onSideChange(side.key, {
                                description: event.target.value,
                              });
                            }}
                          />
                        </Field>
                        <Field
                          label={`Reward side ${String(index + 1)} availability`}
                        >
                          <select
                            className="select"
                            value={side.availability}
                            onChange={(event) => {
                              onSideChange(side.key, {
                                availability: event.target
                                  .value as DiceSideAvailability,
                              });
                            }}
                          >
                            <option value="any">Any</option>
                            <option value="early">Early</option>
                            <option value="late">Late</option>
                          </select>
                        </Field>
                        <Field
                          label={`Reward side ${String(index + 1)} weight`}
                          hint="Leave every weight empty for equal odds."
                          error={errors[`reward:${side.key}:weight`]}
                        >
                          <input
                            inputMode="decimal"
                            value={side.weight}
                            onChange={(event) => {
                              onSideChange(side.key, {
                                weight: event.target.value,
                              });
                            }}
                          />
                        </Field>
                      </div>
                      <div className="reward-side__bonus-toggle">
                        <Switch
                          label={`Enable Bonus Phase for side ${String(index + 1)}`}
                          displayLabel="Bonus Phase"
                          checked={bonusPhase.enabled}
                          onChange={(enabled) => {
                            updateBonus({ enabled });
                          }}
                        />
                      </div>
                      {bonusPhase.enabled ? (
                        <fieldset className="reward-side__bonus">
                          <legend>Side {String(index + 1)} Bonus Phase</legend>
                          <div className="form-grid">
                            <Field
                              label={`Side ${String(index + 1)} Bonus Phase name`}
                              error={errors[`reward:${side.key}:bonus:name`]}
                            >
                              <input
                                value={bonusPhase.name}
                                onChange={(event) => {
                                  updateBonus({ name: event.target.value });
                                }}
                              />
                            </Field>
                            <Field
                              label={`Side ${String(index + 1)} Bonus Phase duration in minutes`}
                              error={
                                errors[`reward:${side.key}:bonus:duration`]
                              }
                            >
                              <input
                                inputMode="decimal"
                                type="text"
                                value={bonusPhase.durationMinutes}
                                onChange={(event) => {
                                  onBonusDurationChange(
                                    side.key,
                                    event.target.value,
                                  );
                                }}
                                onBlur={() => {
                                  onBonusDurationCommit(side.key);
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.key !== 'ArrowUp' &&
                                    event.key !== 'ArrowDown'
                                  ) {
                                    return;
                                  }
                                  event.preventDefault();
                                  onBonusDurationStep(
                                    side.key,
                                    event.key === 'ArrowUp' ? 1 : -1,
                                  );
                                }}
                              />
                            </Field>
                            <AssetPicker
                              label={`Side ${String(index + 1)} Bonus Phase background image`}
                              kind="image"
                              assets={assets}
                              value={bonusPhase.backgroundAsset}
                              onChange={(backgroundAsset) => {
                                updateBonus({ backgroundAsset });
                              }}
                              onUpload={onUploadAsset}
                              onSynchronizeUpload={onSynchronizeAssetUpload}
                            />
                            <AssetPicker
                              label={`Side ${String(index + 1)} Bonus Phase ambient audio`}
                              kind="audio"
                              assets={assets}
                              value={bonusPhase.audioAsset}
                              onChange={(audioAsset) => {
                                updateBonus({ audioAsset });
                              }}
                              onUpload={onUploadAsset}
                              onSynchronizeUpload={onSynchronizeAssetUpload}
                            />
                            <Field
                              label={`Side ${String(index + 1)} Bonus Phase background color`}
                              hint="Optional CSS color."
                            >
                              <input
                                value={bonusPhase.backgroundColor}
                                placeholder="#18342b"
                                onChange={(event) => {
                                  updateBonus({
                                    backgroundColor: event.target.value,
                                  });
                                }}
                              />
                            </Field>
                          </div>
                        </fieldset>
                      ) : null}
                    </li>
                  );
                })}
            </ol>
          </section>
        </div>
      ) : null}
    </section>
  );
}
