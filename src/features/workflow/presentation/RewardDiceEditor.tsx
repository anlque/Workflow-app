import { Button, Field } from '@/shared';
import { AssetPicker, type Asset } from '@/features/assets';

import type { RewardPhaseType } from '../domain/RewardDice';
import type { DiceSideAvailability } from '../domain/DiceSide';

import type {
  RewardDiceDraft,
  RewardSideDraft,
  WorkflowDraftErrors,
} from './useWorkflowEditor';

export type RewardDiceEditorProps = Readonly<{
  assets: readonly Asset[];
  draft: RewardDiceDraft;
  errors: WorkflowDraftErrors;
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

export function RewardDiceEditor({
  draft,
  assets,
  errors,
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

  return (
    <section className="reward-editor">
      <label className="check-control">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => {
            onEnabledChange(event.target.checked);
          }}
        />
        Enable Reward Dice
      </label>
      {draft.enabled ? (
        <details open>
          <summary>Reward Dice configuration</summary>
          <div className="reward-editor__content">
            <Field label="Reward schedule">
              <select
                className="select"
                value={draft.scheduleMode}
                onChange={(event) => {
                  onScheduleModeChange(
                    event.target.value === 'custom' ? 'custom' : 'frequency',
                  );
                }}
              >
                <option value="frequency">Frequency</option>
                <option value="custom">Custom Phase markers</option>
              </select>
            </Field>
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
            <ol className="reward-sides">
              {draft.sides.map((side, index) => {
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
                    <h4>Side {String(index + 1)}</h4>
                    <div className="form-grid">
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
                    <label className="check-control reward-side__bonus-toggle">
                      <input
                        type="checkbox"
                        checked={bonusPhase.enabled}
                        onChange={(event) => {
                          updateBonus({ enabled: event.target.checked });
                        }}
                      />
                      Enable Bonus Phase for side {String(index + 1)}
                    </label>
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
                            error={errors[`reward:${side.key}:bonus:duration`]}
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
                          />
                          <AssetPicker
                            label={`Side ${String(index + 1)} Bonus Phase ambient audio`}
                            kind="audio"
                            assets={assets}
                            value={bonusPhase.audioAsset}
                            onChange={(audioAsset) => {
                              updateBonus({ audioAsset });
                            }}
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
                  </li>
                );
              })}
            </ol>
            {removalDisabled ? (
              <p className="field__hint" id={removalHintId}>
                A Reward Dice needs at least two sides.
              </p>
            ) : null}
            <Button variant="secondary" onClick={onAddSide}>
              Add reward side
            </Button>
          </div>
        </details>
      ) : null}
    </section>
  );
}
