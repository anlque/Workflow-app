import { useState } from 'react';

import type { RewardPhaseType } from '../domain/RewardDice';
import type { AssetReference } from '../domain/Environment';
import type { CreateWorkflowInput, Workflow } from '../domain/Workflow';

export type PhaseDraft = Readonly<{
  key: string;
  type: 'focus' | 'break';
  durationMinutes: string;
  backgroundAsset: AssetReference | undefined;
  audioAsset: AssetReference | undefined;
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
  scheduleMode: 'frequency' | 'custom';
  triggerPhaseType: RewardPhaseType;
  frequency: string;
  customPhaseKeys: readonly string[];
  rerolls: string;
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
    backgroundAsset: undefined,
    audioAsset: undefined,
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
  const phases = workflow?.phases.map((phase) => ({
    key: key(),
    type: phase.type,
    durationMinutes: String(phase.durationSeconds / 60),
    backgroundAsset: phase.environment.backgroundAsset,
    audioAsset: phase.environment.audioAsset,
    backgroundColor: phase.environment.backgroundColor ?? '',
  })) ?? [newPhase()];
  const schedule = workflow?.rewardDice?.schedule;
  return {
    id: workflow?.id ?? workflowId,
    name: workflow?.name ?? '',
    phases,
    rewardDice: {
      enabled: workflow?.rewardDice !== undefined,
      scheduleMode: schedule?.type ?? 'frequency',
      triggerPhaseType:
        schedule?.type === 'frequency' ? schedule.triggerPhaseType : 'focus',
      frequency: String(
        schedule?.type === 'frequency' ? schedule.frequency : 1,
      ),
      customPhaseKeys:
        schedule?.type === 'custom'
          ? schedule.phaseIndexes.flatMap((index) =>
              phases[index] === undefined ? [] : [phases[index].key],
            )
          : [],
      rerolls: String(workflow?.rewardDice?.rerolls ?? 0),
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

function rerollCount(value: string): number | null {
  if (!/^\d$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 0 && parsed <= 3 ? parsed : null;
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

function normalizedDurationMinutes(value: string): string | null {
  const seconds = minutesToDurationSeconds(value);
  return seconds === null ? null : String(seconds / 60);
}

function steppedDurationMinutes(
  value: string,
  direction: -1 | 1,
): string | null {
  const current = normalizedDurationMinutes(value);
  if (current === null) return null;
  return String(Math.max(0.5, Number(current) + direction * 0.5));
}

function frequencyPhaseKeys(draft: WorkflowDraft): readonly string[] {
  const frequency = positiveInteger(draft.rewardDice.frequency) ?? 1;
  let matching = 0;
  return draft.phases.flatMap((phase) => {
    if (phase.type !== draft.rewardDice.triggerPhaseType) return [];
    matching += 1;
    return matching % frequency === 0 ? [phase.key] : [];
  });
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
        ...(phase.backgroundAsset === undefined
          ? {}
          : { backgroundAsset: phase.backgroundAsset }),
        ...(phase.audioAsset === undefined
          ? {}
          : { audioAsset: phase.audioAsset }),
        ...(phase.backgroundColor.trim().length === 0
          ? {}
          : { backgroundColor: phase.backgroundColor.trim() }),
      },
    };
  });

  let rewardDice: CreateWorkflowInput['rewardDice'];
  if (draft.rewardDice.enabled) {
    const frequency = positiveInteger(draft.rewardDice.frequency);
    const rerolls = rerollCount(draft.rewardDice.rerolls);
    if (draft.rewardDice.scheduleMode === 'frequency' && frequency === null) {
      errors['reward:frequency'] = 'Frequency must be a positive whole number.';
    }
    const customPhaseIndexes = draft.rewardDice.customPhaseKeys.map((key) =>
      draft.phases.findIndex((phase) => phase.key === key),
    );
    if (
      draft.rewardDice.scheduleMode === 'custom' &&
      (customPhaseIndexes.some((index) => index < 0) ||
        new Set(draft.rewardDice.customPhaseKeys).size !==
          draft.rewardDice.customPhaseKeys.length)
    ) {
      errors['reward:schedule'] =
        'Choose valid Reward markers for this Workflow.';
    }
    if (rerolls === null) {
      errors['reward:rerolls'] = 'Choose between 0 and 3 rerolls.';
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
    rewardDice = {
      schedule:
        draft.rewardDice.scheduleMode === 'custom'
          ? {
              type: 'custom',
              phaseIndexes: customPhaseIndexes,
            }
          : {
              type: 'frequency',
              triggerPhaseType: draft.rewardDice.triggerPhaseType,
              frequency: frequency ?? 1,
            },
      rerolls: rerolls ?? 0,
      sides,
    };
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
  const rewardAfterPhaseKeys =
    draft.rewardDice.scheduleMode === 'custom'
      ? draft.rewardDice.customPhaseKeys
      : frequencyPhaseKeys(draft);

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
    rewardAfterPhaseKeys,
    setName(name: string): void {
      setDraft((current) => ({ ...current, name }));
    },
    updatePhase,
    commitPhaseDuration(phaseKey: string): boolean {
      const phase = draft.phases.find(({ key: value }) => value === phaseKey);
      if (phase === undefined) return false;
      const durationMinutes = normalizedDurationMinutes(phase.durationMinutes);
      if (durationMinutes === null) return false;
      updatePhase(phaseKey, { durationMinutes });
      return true;
    },
    stepPhaseDuration(phaseKey: string, direction: -1 | 1): boolean {
      const phase = draft.phases.find(({ key: value }) => value === phaseKey);
      if (phase === undefined) return false;
      const durationMinutes = steppedDurationMinutes(
        phase.durationMinutes,
        direction,
      );
      if (durationMinutes === null) return false;
      updatePhase(phaseKey, { durationMinutes });
      return true;
    },
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
        rewardDice: {
          ...current.rewardDice,
          customPhaseKeys: current.rewardDice.customPhaseKeys.filter(
            (value) => value !== phaseKey,
          ),
        },
      }));
    },
    duplicatePhase(index: number): void {
      setDraft((current) => {
        const source = current.phases[index];
        if (source === undefined) return current;
        const duplicate = { ...source, key: key() };
        const phases = [...current.phases];
        phases.splice(index + 1, 0, duplicate);
        const marked = current.rewardDice.customPhaseKeys.includes(source.key);
        return {
          ...current,
          phases,
          rewardDice: {
            ...current.rewardDice,
            customPhaseKeys:
              current.rewardDice.scheduleMode === 'custom' && marked
                ? [...current.rewardDice.customPhaseKeys, duplicate.key]
                : current.rewardDice.customPhaseKeys,
          },
        };
      });
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
    setRewardScheduleMode(scheduleMode: 'frequency' | 'custom'): void {
      setDraft((current) => ({
        ...current,
        rewardDice: {
          ...current.rewardDice,
          scheduleMode,
          customPhaseKeys:
            scheduleMode === 'custom' &&
            current.rewardDice.scheduleMode === 'frequency'
              ? frequencyPhaseKeys(current)
              : current.rewardDice.customPhaseKeys,
        },
      }));
    },
    toggleRewardAfterPhase(phaseKey: string): void {
      setDraft((current) => {
        const selected =
          current.rewardDice.scheduleMode === 'custom'
            ? current.rewardDice.customPhaseKeys
            : frequencyPhaseKeys(current);
        return {
          ...current,
          rewardDice: {
            ...current.rewardDice,
            scheduleMode: 'custom',
            customPhaseKeys: selected.includes(phaseKey)
              ? selected.filter((key) => key !== phaseKey)
              : [...selected, phaseKey],
          },
        };
      });
    },
    setRewardRerolls(rerolls: string): void {
      setDraft((current) => ({
        ...current,
        rewardDice: { ...current.rewardDice, rerolls },
      }));
    },
    setRewardTriggerPhaseType(triggerPhaseType: RewardPhaseType): void {
      setDraft((current) => ({
        ...current,
        rewardDice: { ...current.rewardDice, triggerPhaseType },
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
