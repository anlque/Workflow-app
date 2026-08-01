import {
  createFocusTabController,
  type FocusTabController,
  type FocusTabReference,
} from '../background/createFocusTabController';

export type ChromeFocusTabApi = Readonly<{
  runtime: Readonly<{
    getURL(path: string): string;
  }>;
  tabs: Readonly<{
    query(
      query: Readonly<{ url: string }>,
    ): Promise<readonly FocusTabReference[]>;
    create(properties: Readonly<{ url: string }>): Promise<unknown>;
    update(
      tabId: number,
      properties: Readonly<{ active: true }>,
    ): Promise<unknown>;
  }>;
  windows: Readonly<{
    update(
      windowId: number,
      properties: Readonly<{ focused: true }>,
    ): Promise<unknown>;
  }>;
}>;

export function createChromeFocusTabController(
  chrome: ChromeFocusTabApi,
): FocusTabController {
  const focusUrl = chrome.runtime.getURL('/focus.html');
  return createFocusTabController({
    queryFocusTabs: () => chrome.tabs.query({ url: focusUrl }),
    async createFocusTab() {
      await chrome.tabs.create({ url: focusUrl });
    },
    async activateTab(tabId) {
      await chrome.tabs.update(tabId, { active: true });
    },
    async focusWindow(windowId) {
      await chrome.windows.update(windowId, { focused: true });
    },
  });
}
