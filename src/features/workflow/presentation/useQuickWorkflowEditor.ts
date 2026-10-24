import { useRef, useState } from 'react';

import type { AssetReference } from '../domain/Environment';
import type { QuickWorkflow } from '../domain/QuickWorkflow';
import type { CreateWorkflowInput } from '../domain/Workflow';
import {
  minutesToDurationSeconds,
  normalizedDurationMinutes,
  steppedDurationMinutes,
} from './useWorkflowEditor';

export type QuickEnvironmentDraft = Readonly<{
  durationMinutes: string;
  backgroundAsset: AssetReference | undefined;
  audioAsset: AssetReference | undefined;
  backgroundColor: string;
}>;

export type QuickOptionalEnvironmentDraft = QuickEnvironmentDraft &
  Readonly<{ enabled: boolean; frequency: string }>;

export type QuickRewardSideDraft = Readonly<{
  key: string;
  icon: string;
  title: string;
  weight: string;
}>;

export type QuickRewardDraft = Readonly<{
  enabled: boolean;
  frequency: string;
  sides: readonly QuickRewardSideDraft[];
}>;

export type QuickWorkflowDraft = Readonly<{
  id: string;
  name: string;
  cycleCount: string;
  focus: QuickEnvironmentDraft;
  shortBreak: QuickEnvironmentDraft;
  longBreak: QuickOptionalEnvironmentDraft;
  rewardDice: QuickRewardDraft;
}>;

export type QuickWorkflowDraftErrors = Readonly<Record<string, string>>;
export type QuickWorkflowDraftValidation =
  | Readonly<{
      valid: true;
      input: Extract<CreateWorkflowInput, { mode: 'quick' }>;
    }>
  | Readonly<{ valid: false; errors: QuickWorkflowDraftErrors }>;

function key(): string {
  return crypto.randomUUID();
}

function environmentDraft(
  durationMinutes: string,
  source?: QuickWorkflow['configuration']['focus'],
): QuickEnvironmentDraft {
  return {
    durationMinutes:
      source === undefined
        ? durationMinutes
        : String(source.durationSeconds / 60),
    backgroundAsset: source?.environment.backgroundAsset,
    audioAsset: source?.environment.audioAsset,
    backgroundColor: source?.environment.backgroundColor ?? '',
  };
}

export function createQuickWorkflowDraft(
  workflowId: string,
  workflow?: QuickWorkflow,
): QuickWorkflowDraft {
  const configuration = workflow?.configuration;
  return {
    id: workflow?.id ?? workflowId,
    name: workflow?.name ?? '',
    cycleCount: String(configuration?.cycleCount ?? 4),
    focus: environmentDraft('25', configuration?.focus),
    shortBreak: environmentDraft('5', configuration?.shortBreak),
    longBreak: {
      ...environmentDraft('15', configuration?.longBreak),
      enabled: configuration?.longBreak !== undefined,
      frequency: String(configuration?.longBreak?.frequency ?? 4),
    },
    rewardDice: {
      enabled: configuration?.rewardDice !== undefined,
      frequency: String(configuration?.rewardDice?.frequency ?? 1),
      sides: configuration?.rewardDice?.sides.map((side) => ({
        key: key(),
        icon: side.icon,
        title: side.title,
        weight: side.weight === undefined ? '' : String(side.weight),
      })) ?? [
        { key: key(), icon: '', title: '', weight: '' },
        { key: key(), icon: '', title: '', weight: '' },
      ],
    },
  };
}

function integerInRange(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function environmentInput(draft: QuickEnvironmentDraft) {
  return {
    durationSeconds: minutesToDurationSeconds(draft.durationMinutes) ?? 1,
    environment: {
      ...(draft.backgroundAsset === undefined
        ? {}
        : { backgroundAsset: draft.backgroundAsset }),
      ...(draft.audioAsset === undefined
        ? {}
        : { audioAsset: draft.audioAsset }),
      ...(draft.backgroundColor.trim() === ''
        ? {}
        : { backgroundColor: draft.backgroundColor.trim() }),
    },
  };
}

export function validateQuickWorkflowDraft(
  draft: QuickWorkflowDraft,
): QuickWorkflowDraftValidation {
  const errors: Record<string, string> = {};
  if (draft.name.trim() === '') errors['name'] = 'Name is required.';
  const cycleCount = integerInRange(draft.cycleCount, 1, 20);
  if (cycleCount === null) errors['cycleCount'] = 'Choose 1 through 20 cycles.';
  for (const [name, phase] of [
    ['focus', draft.focus],
    ['shortBreak', draft.shortBreak],
    ['longBreak', draft.longBreak],
  ] as const) {
    if (
      (name !== 'longBreak' || draft.longBreak.enabled) &&
      minutesToDurationSeconds(phase.durationMinutes) === null
    ) {
      errors[`${name}:duration`] =
        'Duration must be at least 0.5 minutes in 0.5-minute increments.';
    }
  }
  const maximum = cycleCount ?? 0;
  const longFrequency = integerInRange(draft.longBreak.frequency, 1, maximum);
  if (draft.longBreak.enabled && longFrequency === null) {
    errors['longBreak:frequency'] =
      `Choose a cycle from 1 through ${String(maximum)}.`;
  }
  const rewardFrequency = integerInRange(
    draft.rewardDice.frequency,
    1,
    maximum,
  );
  if (draft.rewardDice.enabled && rewardFrequency === null) {
    errors['reward:frequency'] =
      `Choose a cycle from 1 through ${String(maximum)}.`;
  }
  if (draft.rewardDice.enabled && draft.rewardDice.sides.length < 2) {
    errors['reward:sides'] = 'Reward Dice needs at least two sides.';
  }
  const usesWeights =
    draft.rewardDice.enabled &&
    draft.rewardDice.sides.some(({ weight }) => weight.trim() !== '');
  const sides = draft.rewardDice.sides.map((side) => {
    if (draft.rewardDice.enabled && side.icon.trim() === '')
      errors[`reward:${side.key}:icon`] = 'Icon is required.';
    if (draft.rewardDice.enabled && side.title.trim() === '')
      errors[`reward:${side.key}:title`] = 'Title is required.';
    const weight = side.weight.trim() === '' ? undefined : Number(side.weight);
    if (
      draft.rewardDice.enabled &&
      usesWeights &&
      (weight === undefined || !Number.isFinite(weight) || weight <= 0)
    ) {
      errors[`reward:${side.key}:weight`] =
        'Enter a positive weight for every side.';
    }
    return {
      icon: side.icon.trim(),
      title: side.title.trim(),
      ...(weight === undefined ? {} : { weight }),
    };
  });
  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    input: {
      mode: 'quick',
      id: draft.id,
      name: draft.name.trim(),
      configuration: {
        cycleCount: cycleCount ?? 1,
        focus: environmentInput(draft.focus),
        shortBreak: environmentInput(draft.shortBreak),
        ...(draft.longBreak.enabled
          ? {
              longBreak: {
                ...environmentInput(draft.longBreak),
                frequency: longFrequency ?? 1,
              },
            }
          : {}),
        ...(draft.rewardDice.enabled
          ? {
              rewardDice: {
                frequency: rewardFrequency ?? 1,
                sides,
              },
            }
          : {}),
      },
    },
  };
}

export function useQuickWorkflowEditor(
  workflowId: string,
  workflow?: QuickWorkflow,
) {
  const initial = useRef(createQuickWorkflowDraft(workflowId, workflow));
  const [draft, setDraft] = useState(initial.current);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(initial.current),
  );
  const updatePhase = (
    phase: 'focus' | 'shortBreak' | 'longBreak',
    patch: Partial<QuickEnvironmentDraft>,
  ) => {
    setDraft((current) => ({
      ...current,
      [phase]: { ...current[phase], ...patch },
    }));
  };
  return {
    draft,
    dirty: JSON.stringify(draft) !== baseline,
    setDraft,
    setName: (name: string) => {
      setDraft((current) => ({ ...current, name }));
    },
    setCycleCount: (cycleCount: string) => {
      setDraft((current) => ({ ...current, cycleCount }));
    },
    markSaved(): void {
      setBaseline(JSON.stringify(draft));
    },
    updatePhase,
    commitDuration(phase: 'focus' | 'shortBreak' | 'longBreak') {
      const normalized = normalizedDurationMinutes(
        draft[phase].durationMinutes,
      );
      if (normalized === null) return false;
      updatePhase(phase, { durationMinutes: normalized });
      return true;
    },
    stepDuration(
      phase: 'focus' | 'shortBreak' | 'longBreak',
      direction: -1 | 1,
    ) {
      const stepped = steppedDurationMinutes(
        draft[phase].durationMinutes,
        direction,
      );
      if (stepped === null) return false;
      updatePhase(phase, { durationMinutes: stepped });
      return true;
    },
  };
}
