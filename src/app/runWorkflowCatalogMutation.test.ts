import { describe, expect, test, vi } from 'vitest';

import { runWorkflowCatalogMutation } from './runWorkflowCatalogMutation';

describe('runWorkflowCatalogMutation', () => {
  test('publishes after a successful mutation and returns its value', async () => {
    const order: string[] = [];
    const mutation = vi.fn(() => {
      order.push('persist');
      return Promise.resolve('saved');
    });
    const events = {
      publishChanged: vi.fn(() => {
        order.push('publish');
        return Promise.resolve();
      }),
    };

    await expect(runWorkflowCatalogMutation(mutation, events)).resolves.toBe(
      'saved',
    );
    expect(order).toEqual(['persist', 'publish']);
  });

  test('does not publish when the mutation fails', async () => {
    const cause = new Error('Persistence failed');
    const mutation = vi.fn(() => Promise.reject(cause));
    const events = { publishChanged: vi.fn(() => Promise.resolve()) };

    await expect(runWorkflowCatalogMutation(mutation, events)).rejects.toBe(
      cause,
    );
    expect(events.publishChanged).not.toHaveBeenCalled();
  });
});
