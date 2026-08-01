import { useState } from 'react';

import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';

export type PhaseDraft = Readonly<{
  key: string;
  type: 'focus' | 'break';
  durationMinutes: string;
  backgroundAssetId: string | undefined;
  audioAssetId: string | undefined;
  backgroundColor: string;
}>;

export type RewardSideDraft = Readonly<{
  key: string;
  icon: string;
  title: string;
  description: string;
  weight: string;
}>;

export type RewardDiceDraft = Readonly<{
  enabled: boolean;
  frequency: string;
  sides: readonly RewardSideDraft[];
}>;

export type WorkflowDraft = Readonly<{
  id: string;
  name: string;
  phases: readonly PhaseDraft[];
  rewardDice: RewardDiceDraft;
}>;

export type WorkflowDraftErrors = Readonly<Record<string, string>>;

export type WorkflowDraftValidation =
  | Readonly<{ valid: true; input: CreateWorkflowInput }>
  | Readonly<{ valid: false; errors: WorkflowDraftErrors }>;

function key(): string {
  return crypto.randomUUID();
}

function newPhase(type: 'focus' | 'break' = 'focus'): PhaseDraft {
  return {
    key: key(),
    type,
    durationMinutes: type === 'focus' ? '25' : '5',
    backgroundAssetId: undefined,
    audioAssetId: undefined,
    backgroundColor: '',
  };
}

function newSide(): RewardSideDraft {
  return {
    key: key(),
    icon: '',
    title: '',
    description: '',
    weight: '',
  };
}

function initialDraft(workflowId: string, workflow?: Workflow): WorkflowDraft {
  return {
    id: workflow?.id ?? workflowId,
    name: workflow?.name ?? '',
    phases: workflow?.phases.map((phase) => ({
      key: key(),
      type: phase.type,
      durationMinutes: String(phase.durationSeconds / 60),
      backgroundAssetId: phase.environment.backgroundAssetId,
      audioAssetId: phase.environment.audioAssetId,
      backgroundColor: phase.environment.backgroundColor ?? '',
    })) ?? [newPhase()],
    rewardDice: {
      enabled: workflow?.rewardDice !== undefined,
      frequency: String(workflow?.rewardDice?.frequency ?? 1),
      sides: workflow?.rewardDice?.sides.map((side) => ({
        key: key(),
        icon: side.icon,
        title: side.title,
        description: side.description ?? '',
        weight: String(side.probability),
      })) ?? [newSide(), newSide()],
    },
  };
}

function positiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function minutesToDurationSeconds(value: string): number | null {
  if (value.trim().length === 0) return null;
  const minutes = Number(value);
  const seconds = minutes * 60;
  return Number.isFinite(minutes) &&
    minutes >= 0.5 &&
    Number.isInteger(minutes * 2) &&
    Number.isSafeInteger(seconds)
    ? seconds
    : null;
}

export function validateWorkflowDraft(
  draft: WorkflowDraft,
): WorkflowDraftValidation {
  const errors: Record<string, string> = {};
  if (draft.name.trim().length === 0) errors['name'] = 'Name is required.';
  const phases = draft.phases.map((phase) => {
    const durationSeconds = minutesToDurationSeconds(phase.durationMinutes);
    if (durationSeconds === null) {
      errors[`phase:${phase.key}:duration`] =
        'Duration must be at least 0.5 minutes in 0.5-minute increments.';
    }
    return {
      type: phase.type,
      durationSeconds: durationSeconds ?? 1,
      environment: {
        ...(phase.backgroundAssetId === undefined
          ? {}
          : { backgroundAssetId: phase.backgroundAssetId }),
        ...(phase.audioAssetId === undefined
          ? {}
          : { audioAssetId: phase.audioAssetId }),
        ...(phase.backgroundColor.trim().length === 0
          ? {}
          : { backgroundColor: phase.backgroundColor.trim() }),
      },
    };
  });

  let rewardDice: CreateWorkflowInput['rewardDice'];
  if (draft.rewardDice.enabled) {
    const frequency = positiveInteger(draft.rewardDice.frequency);
    if (frequency === null) {
      errors['reward:frequency'] = 'Frequency must be a positive whole number.';
    }
    if (draft.rewardDice.sides.length < 2) {
      errors['reward:sides'] = 'Reward Dice needs at least two sides.';
    }
    const usesWeights = draft.rewardDice.sides.some(
      ({ weight }) => weight.trim().length > 0,
    );
    const sides = draft.rewardDice.sides.map((side) => {
      if (side.icon.trim().length === 0) {
        errors[`reward:${side.key}:icon`] = 'Icon is required.';
      }
      if (side.title.trim().length === 0) {
        errors[`reward:${side.key}:title`] = 'Title is required.';
      }
      const weight = usesWeights ? Number(side.weight) : undefined;
      if (
        usesWeights &&
        (side.weight.trim().length === 0 ||
          !Number.isFinite(weight) ||
          (weight ?? 0) <= 0)
      ) {
        errors[`reward:${side.key}:weight`] =
          'Weight must be a positive number for every side.';
      }
      return {
        icon: side.icon.trim(),
        title: side.title.trim(),
        ...(side.description.trim().length === 0
          ? {}
          : { description: side.description.trim() }),
        ...(weight === undefined ? {} : { weight }),
      };
    });
    rewardDice = { frequency: frequency ?? 1, sides };
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    input: {
      id: draft.id,
      name: draft.name.trim(),
      phases,
      ...(rewardDice === undefined ? {} : { rewardDice }),
    },
  };
}

export function useWorkflowEditor(workflowId: string, workflow?: Workflow) {
  const [draft, setDraft] = useState(() => initialDraft(workflowId, workflow));

  const updatePhase = (phaseKey: string, patch: Partial<PhaseDraft>): void => {
    setDraft((current) => ({
      ...current,
      phases: current.phases.map((phase) =>
        phase.key === phaseKey ? { ...phase, ...patch } : phase,
      ),
    }));
  };

  return {
    draft,
    setName(name: string): void {
      setDraft((current) => ({ ...current, name }));
    },
    updatePhase,
    addPhase(): void {
      setDraft((current) => ({
        ...current,
        phases: [...current.phases, newPhase()],
      }));
    },
    removePhase(phaseKey: string): void {
      setDraft((current) => ({
        ...current,
        phases: current.phases.filter(({ key: value }) => value !== phaseKey),
      }));
    },
    movePhase(index: number, offset: -1 | 1): void {
      setDraft((current) => {
        const phases = [...current.phases];
        const target = index + offset;
        const phase = phases[index];
        const destination = phases[target];
        if (phase === undefined || destination === undefined) return current;
        phases[index] = destination;
        phases[target] = phase;
        return { ...current, phases };
      });
    },
    setRewardEnabled(enabled: boolean): void {
      setDraft((current) => ({
        ...current,
        rewardDice: { ...current.rewardDice, enabled },
      }));
    },
    setRewardFrequency(frequency: string): void {
      setDraft((current) => ({
        ...current,
        rewardDice: { ...current.rewardDice, frequency },
      }));
    },
    updateRewardSide(sideKey: string, patch: Partial<RewardSideDraft>): void {
      setDraft((current) => ({
        ...current,
        rewardDice: {
          ...current.rewardDice,
          sides: current.rewardDice.sides.map((side) =>
            side.key === sideKey ? { ...side, ...patch } : side,
          ),
        },
      }));
    },
    addRewardSide(): void {
      setDraft((current) => ({
        ...current,
        rewardDice: {
          ...current.rewardDice,
          sides: [...current.rewardDice.sides, newSide()],
        },
      }));
    },
    removeRewardSide(sideKey: string): void {
      setDraft((current) => {
        if (current.rewardDice.sides.length <= 2) return current;
        return {
          ...current,
          rewardDice: {
            ...current.rewardDice,
            sides: current.rewardDice.sides.filter(
              ({ key: value }) => value !== sideKey,
            ),
          },
        };
      });
    },
  };
}
