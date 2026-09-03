# Runtime and Navigation

This reference maps Chrome extension locations to source entrypoints and
explains how navigation occurs. Locusora does not use React Router.

## Extension Documents

| Runtime location | Production extension URL or manifest entry | WXT source | Application composition |
| --- | --- | --- | --- |
| Background worker | `background.service_worker = background.js` | [`entrypoints/background.ts`](../../entrypoints/background.ts) | [`bootstrapBackground()`](../../src/app/background/bootstrapBackground.ts) |
| Focus view | `chrome-extension://<extension-id>/focus.html` | [`entrypoints/focus/index.html`](../../entrypoints/focus/index.html) and [`main.tsx`](../../entrypoints/focus/main.tsx) | [`bootstrapFocus()`](../../src/app/focus/bootstrapFocus.tsx) |
| Options page | `chrome-extension://<extension-id>/options.html`; declared by `options_ui.page` | [`entrypoints/options/index.html`](../../entrypoints/options/index.html) and [`main.tsx`](../../entrypoints/options/main.tsx) | [`bootstrapOptions()`](../../src/app/options/bootstrapOptions.tsx) |
| Side panel | `chrome-extension://<extension-id>/sidepanel.html`; declared by `side_panel.default_path` | [`entrypoints/sidepanel/index.html`](../../entrypoints/sidepanel/index.html) and [`main.tsx`](../../entrypoints/sidepanel/main.tsx) | [`bootstrapSidePanel()`](../../src/app/side-panel/bootstrapSidePanel.tsx) |

The generated URLs are extension origin URLs, not public web routes. WXT derives
their manifest entries from the physical `entrypoints/` convention and
[`wxt.config.ts`](../../wxt.config.ts).

## Toolbar Action to Focus Tab

The manifest action has no popup. The background bootstrap registers
`browser.action.onClicked` and delegates to the focus-tab controller:

1. `browser.runtime.getURL('/focus.html')` resolves the exact extension URL.
2. `browser.tabs.query({ url: focusUrl })` searches all browser windows.
3. If no matching tab exists, `browser.tabs.create({ url: focusUrl })` opens one.
4. If a matching tab exists, `browser.tabs.update(tabId, { active: true })`
   activates it.
5. When its `windowId` is known,
   `browser.windows.update(windowId, { focused: true })` focuses that window.

[`createFocusTabController()`](../../src/app/background/createFocusTabController.ts)
coalesces concurrent `openOrActivate()` calls behind one pending Promise. The
same Chrome adapter is used when the side panel opens the focus view.

This mechanism intentionally maintains at most one found focus tab in normal
operation. It does not navigate the active web tab and requires no host
permission.

## Opening the Options Page

Focus and side-panel composition call `browser.runtime.openOptionsPage()`.
Chrome opens or focuses the manifest-declared `options.html` document in a tab.

The side panel first saves the selected `WorkflowId` as
`lastSelectedWorkflowId` in Settings when **Open** is used, then opens Options.
The Options page reads that preference while selecting the initial Workflow.
This is durable selection handoff, not a query-string route.

The Options HTML metadata requests `open_in_tab`; the generated manifest records
the same behavior under `options_ui`.

## Opening and Closing the Side Panel

The focus view receives three injected operations from
[`src/app/closeSidePanel.ts`](../../src/app/closeSidePanel.ts):

- `openSidePanel()` gets the current window and calls
  `browser.sidePanel.open({ windowId })`;
- `closeSidePanel()` calls the corresponding close operation;
- `subscribeSidePanelState()` maps `sidePanel.onOpened` and
  `sidePanel.onClosed` to a Boolean presentation value.

Opening or activating the focus tab does not implicitly close the side panel.
The focus button is an explicit independent control. While an operation is
pending, its optimistic label is rolled back if Chrome rejects the call and
subsequent browser lifecycle events update it.

The programmable close API is the reason the documented Chrome baseline is 141
or newer.

## What Is Not Routing

Locusora has no React Router and no client-side URL router.

The Options page uses local React state for these tabs:

```text
workflows | assets | settings
```

The side panel uses local React state for these views:

```text
session | workflows
```

Changing either value does not change the URL, create browser history or load a
different JavaScript bundle. The state belongs to the already loaded document:

- Options renders one active `tabpanel` and keeps Workflow selection in local
  component state.
- The side panel moves to the Session view when a new active Session appears,
  permits returning to the Workflow list, and displays a compact active-Session
  bar there.

Calling these values routes would imply lifecycle, deep-link and history
contracts that do not exist.

## Page Separation and Code Splitting

The three HTML pages are separate because Chrome loads focus, Options and side
panel as different extension surfaces with different browser lifecycles. Each
page has its own DOM, bootstrap and React root.

WXT/Vite builds one entry chunk per page and may extract common dependencies
such as React, global styles or shared feature code into reusable chunks. That
code splitting is a build consequence of multiple entry documents, not the
architectural reason for creating them. Local Options tabs and side-panel views
remain inside their page bundle.

Do not import generated chunk names. Their hashes and grouping may change on
every build.

## Lifecycles and State Restoration

| Event | What survives | What is reconstructed |
| --- | --- | --- |
| Focus tab reload or reopen | IndexedDB records, Settings and authoritative background Session | React state, Zustand projection, object URLs and audio state |
| Options page close/reopen | Saved Workflows, Assets and Settings | Active tab, unsaved editor draft, dialog and feedback state |
| Side panel close/reopen | Saved data and background Session | Local `session | workflows` view and Zustand projection |
| Background worker restart | Persisted Session anchors and records | Message/alarm handlers, repository connections, in-memory command cache and next alarm |

Never make correctness depend on two contexts being open simultaneously.
Runtime messages synchronize active contexts; persistence and startup
reconciliation restore contexts that were absent.

## Where Navigation Code Belongs

Navigation has meaning at the extension-surface boundary, so its narrow Chrome
adapters live in `src/app/` under
[ADR-0008](../adr/ADR-0008-browser-integration-boundaries.md). React receives
functions such as `openOptions()` and `openFocusView()` through dependencies.
Feature Domain, Application and Presentation modules do not import WXT/browser
navigation APIs.

## Verification Sources

- [`wxt.config.ts`](../../wxt.config.ts) owns requested permissions and action
  metadata.
- [`createChromeFocusTabController.ts`](../../src/app/focus/createChromeFocusTabController.ts)
  adapts focus navigation to Chrome.
- [`createFocusTabController.test.ts`](../../src/app/background/createFocusTabController.test.ts)
  proves create, activation, window focus and request coalescing.
- [`closeSidePanel.ts`](../../src/app/closeSidePanel.ts) owns focus-view panel
  lifecycle integration.
- [`OptionsApp.tsx`](../../src/app/options/OptionsApp.tsx) and
  [`SidePanelApp.tsx`](../../src/app/side-panel/SidePanelApp.tsx) own local view
  state.
