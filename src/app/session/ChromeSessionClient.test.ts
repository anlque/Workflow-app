import { describe, expect, test, vi } from 'vitest';

import { createSession, createSessionId } from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import {
  ChromeSessionClient,
  type SessionRuntime,
} from './ChromeSessionClient';

describe('ChromeSessionClient', () => {
  test.each([
    ['rollReward', 'session/roll-reward'],
    ['rerollReward', 'session/reroll-reward'],
  ] as const)('sends %s as an exact command', async (method, type) => {
    const session = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      }),
      1_000,
    );
    const runtime: SessionRuntime = {
      sendMessage: vi.fn(() =>
        Promise.resolve({ ok: true, result: structuredClone(session) }),
      ),
      addMessageListener: vi.fn(),
      removeMessageListener: vi.fn(),
    };
    const client = new ChromeSessionClient(runtime, () => 'command-1');
    await client[method](createSessionId('session-1'), 'session-1:0');
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type,
      commandId: 'command-1',
      sessionId: 'session-1',
      rewardRitualId: 'session-1:0',
    });
  });
  test('sends a typed continue-Reward command', async () => {
    const session = createSession(
      'session-1',
      createWorkflow({
        id: 'workflow-1',
        name: 'Deep work',
        phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      }),
      1_000,
    );
    const runtime: SessionRuntime = {
      sendMessage: vi.fn(() =>
        Promise.resolve({ ok: true, result: structuredClone(session) }),
      ),
      addMessageListener: vi.fn(),
      removeMessageListener: vi.fn(),
    };
    const client = new ChromeSessionClient(runtime, () => 'command-1');

    await client.continueReward(createSessionId('session-1'), 'session-1:0');

    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type: 'session/continue-reward',
      commandId: 'command-1',
      sessionId: 'session-1',
      rewardRitualId: 'session-1:0',
    });
  });
});
