import { describe, expect, test } from 'vitest';

import { createWorkflow } from '../domain/createWorkflow';
import {
  listWorkflowConfigurationEnvironments,
  mapWorkflowConfigurationEnvironments,
} from './workflowEnvironments';

describe('Workflow configuration Environments', () => {
  test('lists Quick source Environments once rather than generated Phases', () => {
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick',
      name: 'Quick',
      configuration: {
        cycleCount: 4,
        focus: {
          durationSeconds: 1_500,
          environment: { backgroundColor: '#111111' },
        },
        shortBreak: {
          durationSeconds: 300,
          environment: { backgroundColor: '#222222' },
        },
        longBreak: {
          durationSeconds: 900,
          environment: { backgroundColor: '#333333' },
          frequency: 2,
        },
      },
    });
    expect(
      listWorkflowConfigurationEnvironments(workflow).map(
        ({ location }) => location,
      ),
    ).toEqual([
      { owner: 'quick', phase: 'focus' },
      { owner: 'quick', phase: 'short-break' },
      { owner: 'quick', phase: 'long-break' },
    ]);
  });

  test('maps a Quick source and rematerializes every affected Phase', async () => {
    const workflow = createWorkflow({
      mode: 'quick',
      id: 'quick',
      name: 'Quick',
      configuration: {
        cycleCount: 2,
        focus: { durationSeconds: 1_500, environment: {} },
        shortBreak: { durationSeconds: 300, environment: {} },
        rewardDice: {
          frequency: 1,
          sides: [
            { icon: 'a', title: 'A', weight: 2 },
            { icon: 'b', title: 'B', weight: 4 },
          ],
        },
      },
    });
    const mapped = await mapWorkflowConfigurationEnvironments(
      workflow,
      (environment, location) =>
        location.owner === 'quick' && location.phase === 'focus'
          ? { ...environment, backgroundColor: '#abcdef' }
          : environment,
    );
    expect(mapped.mode).toBe('quick');
    if (mapped.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    expect(
      mapped.configuration.rewardDice?.sides.map(({ weight }) => weight),
    ).toEqual([2, 4]);
    expect(
      mapped.phases
        .filter(({ type }) => type === 'focus')
        .every(({ environment }) => environment.backgroundColor === '#abcdef'),
    ).toBe(true);
  });
});
