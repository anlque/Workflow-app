import { Button, Field } from '@/shared';

import type {
  RewardDiceDraft,
  RewardSideDraft,
  WorkflowDraftErrors,
} from './useWorkflowEditor';

export type RewardDiceEditorProps = Readonly<{
  draft: RewardDiceDraft;
  errors: WorkflowDraftErrors;
  onEnabledChange(enabled: boolean): void;
  onFrequencyChange(value: string): void;
  onSideChange(key: string, patch: Partial<RewardSideDraft>): void;
  onAddSide(): void;
  onRemoveSide(key: string): void;
}>;

export function RewardDiceEditor({
  draft,
  errors,
  onEnabledChange,
  onFrequencyChange,
  onSideChange,
  onAddSide,
  onRemoveSide,
}: RewardDiceEditorProps) {
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
            <Field
              label="Reward frequency"
              hint="Completed focus phases between rolls."
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
            {errors['reward:sides'] === undefined ? null : (
              <p className="field__error" role="alert">
                {errors['reward:sides']}
              </p>
            )}
            <ol className="reward-sides">
              {draft.sides.map((side, index) => (
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
                          onSideChange(side.key, { icon: event.target.value });
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
                          onSideChange(side.key, { title: event.target.value });
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
                  <Button
                    variant="quiet"
                    aria-label={`Remove reward side ${String(index + 1)}`}
                    onClick={() => {
                      onRemoveSide(side.key);
                    }}
                  >
                    Remove side
                  </Button>
                </li>
              ))}
            </ol>
            <Button variant="secondary" onClick={onAddSide}>
              Add reward side
            </Button>
          </div>
        </details>
      ) : null}
    </section>
  );
}
