import { useState } from 'react';

import { AssetPicker, type Asset } from '@/features/assets';
import { Button, Field, Select } from '@/shared';

import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';
import { RewardDiceEditor } from './RewardDiceEditor';
import {
  useWorkflowEditor,
  validateWorkflowDraft,
  type WorkflowDraftErrors,
} from './useWorkflowEditor';

export type WorkflowEditorProps = Readonly<{
  workflow?: Workflow;
  workflowId: string;
  assets: readonly Asset[];
  onSave(input: CreateWorkflowInput): Promise<void>;
}>;

export function WorkflowEditor({
  workflow,
  workflowId,
  assets,
  onSave,
}: WorkflowEditorProps) {
  const editor = useWorkflowEditor(workflowId, workflow);
  const [errors, setErrors] = useState<WorkflowDraftErrors>({});
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(): Promise<void> {
    const validation = validateWorkflowDraft(editor.draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setSaveError(null);
    setPending(true);
    try {
      await onSave(validation.input);
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
        <Button type="submit" variant="primary" pending={pending}>
          Save workflow
        </Button>
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
        <ol className="phase-list">
          {editor.draft.phases.map((phase, index) => (
            <li className="phase-item" key={phase.key}>
              <div className="phase-item__header">
                <h4>Phase {String(index + 1)}</h4>
                <div className="phase-item__actions">
                  <Button
                    variant="quiet"
                    aria-label={`Move Phase ${String(index + 1)} up`}
                    disabled={index === 0}
                    onClick={() => {
                      editor.movePhase(index, -1);
                    }}
                  >
                    Move up
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={`Move Phase ${String(index + 1)} down`}
                    disabled={index === editor.draft.phases.length - 1}
                    onClick={() => {
                      editor.movePhase(index, 1);
                    }}
                  >
                    Move down
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={`Remove Phase ${String(index + 1)}`}
                    disabled={editor.draft.phases.length === 1}
                    onClick={() => {
                      editor.removePhase(phase.key);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <div className="form-grid">
                <Select
                  label={`Phase ${String(index + 1)} type`}
                  value={phase.type}
                  onChange={(event) => {
                    editor.updatePhase(phase.key, {
                      type: event.target.value === 'break' ? 'break' : 'focus',
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
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={phase.durationMinutes}
                    onChange={(event) => {
                      editor.updatePhase(phase.key, {
                        durationMinutes: event.target.value,
                      });
                    }}
                  />
                </Field>
                <AssetPicker
                  label="Background image"
                  kind="image"
                  assets={assets}
                  value={phase.backgroundAssetId}
                  onChange={(backgroundAssetId) => {
                    editor.updatePhase(phase.key, { backgroundAssetId });
                  }}
                />
                <AssetPicker
                  label="Ambient audio"
                  kind="audio"
                  assets={assets}
                  value={phase.audioAssetId}
                  onChange={(audioAssetId) => {
                    editor.updatePhase(phase.key, { audioAssetId });
                  }}
                />
                <Field label="Background color" hint="Optional CSS color.">
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
            </li>
          ))}
        </ol>
      </section>

      <RewardDiceEditor
        draft={editor.draft.rewardDice}
        errors={errors}
        onEnabledChange={(enabled) => {
          editor.setRewardEnabled(enabled);
        }}
        onFrequencyChange={(frequency) => {
          editor.setRewardFrequency(frequency);
        }}
        onSideChange={(key, side) => {
          editor.updateRewardSide(key, side);
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
