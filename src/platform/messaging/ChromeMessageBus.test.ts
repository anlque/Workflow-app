import { describe, expect, test, vi } from 'vitest';

import { ChromeMessageBus } from './ChromeMessageBus';

function runtime(sendMessage: (message: unknown) => Promise<unknown>) {
  return {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage,
  };
}

describe('ChromeMessageBus', () => {
  test('allows a Session broadcast when no extension document is listening', async () => {
    const messages = new ChromeMessageBus(
      runtime(() =>
        Promise.reject(
          new Error(
            'Could not establish connection. Receiving end does not exist.',
          ),
        ),
      ),
    );

    await expect(
      messages.publishSessionChanged({
        type: 'session/changed',
        session: null,
      }),
    ).resolves.toBeUndefined();
  });

  test('propagates a real Session broadcast failure', async () => {
    const messages = new ChromeMessageBus(
      runtime(() => Promise.reject(new Error('runtime unavailable'))),
    );

    await expect(
      messages.publishSessionChanged({
        type: 'session/changed',
        session: null,
      }),
    ).rejects.toThrow('runtime unavailable');
  });
});
