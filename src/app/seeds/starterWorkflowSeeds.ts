import type { CreateDetailedWorkflowInput } from '@/features/workflow';

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const role = (value: string) => ({ type: 'role' as const, role: value });

export const starterWorkflowSeeds: readonly CreateDetailedWorkflowInput[] =
  deepFreeze([
    {
      id: 'locusora:seed:v2:workflow:quick-focus',
      name: 'Quick Focus',
      phases: [
        {
          name: 'Quick focus',
          type: 'focus',
          durationSeconds: 10 * 60,
          environment: {
            backgroundAsset: role('Starter background — Mosswood'),
            audioAsset: role('Starter ambience — Lofi Chill'),
          },
        },
      ],
    },
    {
      id: 'locusora:seed:v2:workflow:balanced-flow',
      name: 'Balanced Flow',
      phases: [
        {
          name: 'Settle in',
          type: 'focus',
          durationSeconds: 25 * 60,
          environment: {
            backgroundAsset: role('Starter background — Rainlit Window'),
            audioAsset: role('Starter ambience — Cozy Bedroom Rain'),
          },
        },
        {
          name: 'Short break',
          type: 'break',
          durationSeconds: 5 * 60,
          environment: {
            backgroundAsset: role('Starter background — Deep Tide'),
            audioAsset: role('Starter ambience — Healing Bowl'),
          },
        },
        {
          name: 'Deep work',
          type: 'focus',
          durationSeconds: 25 * 60,
          environment: {
            backgroundAsset: role('Starter background — Rainlit Window'),
            audioAsset: role('Starter ambience — Cozy Bedroom Rain'),
          },
        },
      ],
    },
    {
      id: 'locusora:seed:v2:workflow:reward-journey',
      name: 'Reward Journey',
      phases: [
        {
          name: 'Focused effort',
          type: 'focus',
          durationSeconds: 20 * 60,
          environment: {
            backgroundAsset: role('Starter background — Amber Library'),
            audioAsset: role('Starter ambience — Lofi Chill'),
          },
        },
        {
          name: 'Reset',
          type: 'break',
          durationSeconds: 5 * 60,
          environment: {
            backgroundAsset: role('Starter background — Deep Tide'),
            audioAsset: role('Starter ambience — Healing Bowl'),
          },
        },
        {
          name: 'Finish strong',
          type: 'focus',
          durationSeconds: 20 * 60,
          environment: {
            backgroundAsset: role('Starter background — Starlit Ridge'),
            audioAsset: role('Starter ambience — Cozy Bedroom Rain'),
          },
        },
      ],
      rewardDice: {
        schedule: {
          type: 'frequency',
          triggerPhaseType: 'focus',
          frequency: 1,
        },
        rerolls: 1,
        sides: [
          {
            icon: '☕',
            title: 'Tea ritual',
            description: 'Step away and make a warm drink.',
            availability: 'any',
            bonusPhase: {
              name: 'Tea ritual',
              durationSeconds: 5 * 60,
              environment: {
                backgroundAsset: role('Starter background — Rainlit Window'),
                audioAsset: role('Starter ambience — Cozy Bedroom Rain'),
              },
            },
          },
          {
            icon: '🧘',
            title: 'Stretch reset',
            description: 'Move, breathe, and reset.',
            availability: 'any',
            bonusPhase: {
              name: 'Stretch reset',
              durationSeconds: 3 * 60,
              environment: {
                backgroundAsset: role('Starter background — Mosswood'),
                audioAsset: role('Starter ambience — Healing Bowl'),
              },
            },
          },
        ],
      },
    },
  ]);
