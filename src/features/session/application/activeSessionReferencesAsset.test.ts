import { describe, expect, test } from 'vitest';

import type { AssetId } from '@/shared';
import { createWorkflow } from '@/features/workflow';

import { restoreSession, type Session } from '../domain/Session';
import type { SessionRepository } from './SessionRepository';
import { activeSessionReferencesAsset } from './activeSessionReferencesAsset';

const targetId = 'asset-target' as AssetId;

function workflow(reference: 'background' | 'audio' | 'other' = 'background') {
  return createWorkflow({
    id: 'workflow-1',
    name: 'Deep work',
    phases: [
      { type: 'focus', durationSeconds: 10, environment: {} },
      {
        type: 'break',
        durationSeconds: 5,
        environment:
          reference === 'background'
            ? { backgroundAssetId: targetId }
            : reference === 'audio'
              ? { audioAssetId: targetId }
              : { backgroundAssetId: 'asset-other' },
      },
    ],
  });
}

function session(
  status: Session['status'],
  reference: 'background' | 'audio' | 'other' = 'background',
  pauseReason: 'user' | 'reward' = 'user',
): Session {
  const base = {
    id: `session-${status}-${pauseReason}`,
    workflow: workflow(reference),
    currentPhaseIndex: 0,
  } as const;
  switch (status) {
    case 'running':
      return restoreSession({
        ...base,
        status,
        phaseStartedAt: 1_000,
        phaseEndsAt: 11_000,
      });
    case 'transitioning':
      return restoreSession({ ...base, status, transitionEndsAt: 12_000 });
    case 'paused':
      return restoreSession({
        ...base,
        status,
        pauseReason,
        pausedAt: 2_000,
        remainingMilliseconds: 9_000,
      });
    case 'completed':
      return restoreSession({ ...base, status, completedAt: 12_000 });
    case 'stopped':
      return restoreSession({ ...base, status, stoppedAt: 2_000 });
  }
}

function repository(active: Session | null): SessionRepository {
  return {
    getActive: () => Promise.resolve(active),
    get: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
}

describe('activeSessionReferencesAsset', () => {
  test.each([
    ['background', 'running'],
    ['audio', 'running'],
    ['background', 'transitioning'],
    ['background', 'paused'],
  ] as const)(
    'finds a %s reference in any Phase of a %s Session snapshot',
    async (reference, status) => {
      await expect(
        activeSessionReferencesAsset(
          repository(session(status, reference)),
          targetId,
        ),
      ).resolves.toBe(true);
    },
  );

  test.each(['user', 'reward'] as const)(
    'blocks a %s-paused Session snapshot reference',
    async (pauseReason) => {
      await expect(
        activeSessionReferencesAsset(
          repository(session('paused', 'audio', pauseReason)),
          targetId,
        ),
      ).resolves.toBe(true);
    },
  );

  test.each(['completed', 'stopped'] as const)(
    'ignores a %s Session',
    async (status) => {
      await expect(
        activeSessionReferencesAsset(repository(session(status)), targetId),
      ).resolves.toBe(false);
    },
  );

  test('returns false without an active Session', async () => {
    await expect(
      activeSessionReferencesAsset(repository(null), targetId),
    ).resolves.toBe(false);
  });

  test('returns false when the active snapshot references another Asset', async () => {
    await expect(
      activeSessionReferencesAsset(
        repository(session('running', 'other')),
        targetId,
      ),
    ).resolves.toBe(false);
  });
});
