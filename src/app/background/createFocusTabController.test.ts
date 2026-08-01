import { describe, expect, test, vi } from 'vitest';

import {
  createFocusTabController,
  registerFocusAction,
  type FocusAction,
  type FocusTabBrowser,
  type FocusTabController,
  type FocusTabReference,
} from './createFocusTabController';

function browserWith(tabs: readonly FocusTabReference[]): FocusTabBrowser & {
  queryFocusTabs: ReturnType<
    typeof vi.fn<() => Promise<readonly FocusTabReference[]>>
  >;
  createFocusTab: ReturnType<typeof vi.fn<() => Promise<void>>>;
  activateTab: ReturnType<typeof vi.fn<(tabId: number) => Promise<void>>>;
  focusWindow: ReturnType<typeof vi.fn<(windowId: number) => Promise<void>>>;
} {
  return {
    queryFocusTabs: vi.fn(() => Promise.resolve(tabs)),
    createFocusTab: vi.fn(() => Promise.resolve()),
    activateTab: vi.fn(() => Promise.resolve()),
    focusWindow: vi.fn(() => Promise.resolve()),
  };
}

describe('createFocusTabController', () => {
  test('creates the Focus Tab when none exists', async () => {
    const browser = browserWith([]);

    await createFocusTabController(browser).openOrActivate();

    expect(browser.createFocusTab).toHaveBeenCalledOnce();
    expect(browser.activateTab).not.toHaveBeenCalled();
  });

  test('activates the existing Focus Tab and its window', async () => {
    const browser = browserWith([{ id: 7, windowId: 3 }]);

    await createFocusTabController(browser).openOrActivate();

    expect(browser.createFocusTab).not.toHaveBeenCalled();
    expect(browser.activateTab).toHaveBeenCalledWith(7);
    expect(browser.focusWindow).toHaveBeenCalledWith(3);
  });

  test('deduplicates concurrent open requests', async () => {
    let resolveQuery:
      ((tabs: readonly FocusTabReference[]) => void) | undefined;
    const browser = browserWith([]);
    browser.queryFocusTabs.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve;
        }),
    );
    const controller = createFocusTabController(browser);

    const first = controller.openOrActivate();
    const second = controller.openOrActivate();
    resolveQuery?.([]);
    await Promise.all([first, second]);

    expect(browser.queryFocusTabs).toHaveBeenCalledOnce();
    expect(browser.createFocusTab).toHaveBeenCalledOnce();
  });

  test('opens the Focus Tab from the registered extension action', async () => {
    let listener: (() => void) | undefined;
    const action: FocusAction = {
      addClickListener(nextListener) {
        listener = nextListener;
      },
    };
    const controller: FocusTabController = {
      openOrActivate: vi.fn(() => Promise.resolve()),
    };

    registerFocusAction(action, controller);
    listener?.();
    await Promise.resolve();

    expect(controller.openOrActivate).toHaveBeenCalledOnce();
  });

  test('reports a Focus Tab failure at the action boundary', async () => {
    let listener: (() => void) | undefined;
    const action: FocusAction = {
      addClickListener(nextListener) {
        listener = nextListener;
      },
    };
    const failure = new Error('Tabs unavailable');
    const controller: FocusTabController = {
      openOrActivate: () => Promise.reject(failure),
    };
    const onError = vi.fn();

    registerFocusAction(action, controller, onError);
    listener?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(failure);
  });
});
