// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { createWorkflow } from '../domain/createWorkflow';
import {
  createQuickWorkflowDraft,
  useQuickWorkflowEditor,
  validateQuickWorkflowDraft,
} from './useQuickWorkflowEditor';

describe('useQuickWorkflowEditor', () => {
  test('creates the approved empty Quick defaults', () => {
    const draft = createQuickWorkflowDraft('quick-1');
    expect(draft).toMatchObject({
      id: 'quick-1',
      name: '',
      cycleCount: '4',
      focus: { durationMinutes: '25' },
      shortBreak: { durationMinutes: '5' },
      longBreak: { enabled: false, durationMinutes: '15', frequency: '4' },
      rewardDice: { enabled: false, frequency: '1' },
    });
    expect(draft.focus.backgroundAsset).toBeUndefined();
    expect(draft.shortBreak.audioAsset).toBeUndefined();
  });

  test('validates the compact configuration and keeps generated phases out of the input', () => {
    const draft = createQuickWorkflowDraft('quick-1');
    const result = validateQuickWorkflowDraft({ ...draft, name: 'Deep work' });
    expect(result).toEqual({
      valid: true,
      input: {
        mode: 'quick',
        id: 'quick-1',
        name: 'Deep work',
        configuration: {
          cycleCount: 4,
          focus: { durationSeconds: 1_500, environment: {} },
          shortBreak: { durationSeconds: 300, environment: {} },
        },
      },
    });
  });

  test('reports invalid cycle-dependent frequencies without rewriting them', () => {
    const draft = createQuickWorkflowDraft('quick-1');
    const result = validateQuickWorkflowDraft({
      ...draft,
      name: 'Cadence',
      cycleCount: '3',
      longBreak: { ...draft.longBreak, enabled: true, frequency: '4' },
      rewardDice: {
        ...draft.rewardDice,
        enabled: true,
        frequency: '4',
        sides: [
          { key: 'one', icon: '☕', title: 'Tea', weight: '' },
          { key: 'two', icon: '🚶', title: 'Walk', weight: '' },
        ],
      },
    });
    if (result.valid) throw new Error('Expected validation errors.');
    expect(result.errors['longBreak:frequency']).toBe(
      'Choose a cycle from 1 through 3.',
    );
    expect(result.errors['reward:frequency']).toBe(
      'Choose a cycle from 1 through 3.',
    );
  });

  test('enforces two sides and all-empty or all-positive weights', () => {
    const draft = createQuickWorkflowDraft('quick-1');
    const result = validateQuickWorkflowDraft({
      ...draft,
      name: 'Rewards',
      rewardDice: {
        ...draft.rewardDice,
        enabled: true,
        sides: [
          { key: 'one', icon: '', title: '', weight: '1' },
          { key: 'two', icon: '🚶', title: 'Walk', weight: '' },
        ],
      },
    });
    if (result.valid) throw new Error('Expected validation errors.');
    expect(result.errors['reward:one:icon']).toBe('Icon is required.');
    expect(result.errors['reward:one:title']).toBe('Title is required.');
    expect(result.errors['reward:two:weight']).toBe(
      'Enter a positive weight for every side.',
    );
  });

  test('hydrates Quick configuration and normalizes duration only on commit', () => {
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick-1',
      name: 'Flow',
      configuration: {
        cycleCount: 2,
        focus: { durationSeconds: 60, environment: {} },
        shortBreak: { durationSeconds: 30, environment: {} },
      },
    });
    if (workflow.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    const { result } = renderHook(() =>
      useQuickWorkflowEditor('quick-1', workflow),
    );
    act(() => {
      result.current.updatePhase('focus', { durationMinutes: '1.5' });
    });
    expect(result.current.draft.focus.durationMinutes).toBe('1.5');
    act(() => {
      expect(result.current.stepDuration('focus', 1)).toBe(true);
    });
    expect(result.current.draft.focus.durationMinutes).toBe('2');
    expect(result.current.dirty).toBe(true);
  });
});
