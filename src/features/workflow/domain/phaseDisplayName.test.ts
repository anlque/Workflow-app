import { describe, expect, test } from 'vitest';

import { createWorkflow } from './createWorkflow';
import { phaseDisplayName } from './phaseDisplayName';

describe('phaseDisplayName', () => {
  test('uses a custom name or the current one-based Phase position', () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [
        {
          name: 'Writing',
          type: 'focus',
          durationSeconds: 60,
          environment: {},
        },
        { type: 'break', durationSeconds: 30, environment: {} },
      ],
    });

    const [first, second] = workflow.phases;
    if (second === undefined) throw new Error('Expected two Phases.');
    expect(phaseDisplayName(first, 0)).toBe('Writing');
    expect(phaseDisplayName(second, 1)).toBe('Phase 2');
  });
});
