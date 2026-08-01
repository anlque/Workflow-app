export type FocusTabReference = Readonly<{
  id?: number | undefined;
  windowId?: number | undefined;
}>;

export type FocusTabBrowser = Readonly<{
  queryFocusTabs(): Promise<readonly FocusTabReference[]>;
  createFocusTab(): Promise<void>;
  activateTab(tabId: number): Promise<void>;
  focusWindow(windowId: number): Promise<void>;
}>;

export type FocusTabController = Readonly<{
  openOrActivate(): Promise<void>;
}>;

export type FocusAction = Readonly<{
  addClickListener(listener: () => void): void;
}>;

export function createFocusTabController(
  browser: FocusTabBrowser,
): FocusTabController {
  let opening: Promise<void> | null = null;

  async function performOpen(): Promise<void> {
    const [existing] = await browser.queryFocusTabs();
    if (existing?.id === undefined) {
      await browser.createFocusTab();
      return;
    }
    await browser.activateTab(existing.id);
    if (existing.windowId !== undefined) {
      await browser.focusWindow(existing.windowId);
    }
  }

  return {
    openOrActivate(): Promise<void> {
      opening ??= performOpen().finally(() => {
        opening = null;
      });
      return opening;
    },
  };
}

export function registerFocusAction(
  action: FocusAction,
  controller: FocusTabController,
  onError: (error: unknown) => void = console.error,
): void {
  action.addClickListener(() => {
    void controller.openOrActivate().catch(onError);
  });
}
