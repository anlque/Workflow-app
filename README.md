# Flowarium

Flowarium is a local-first Chrome extension for building personalized focus
Workflows, running durable timed Sessions, creating atmospheric environments and
adding optional Reward Dice rituals.

## MVP scope

- Create, edit, duplicate, reorder, import and export Workflows.
- Compose ordered focus and break Phases with local image/audio environments.
- Open or activate one dedicated focus tab from the extension toolbar, select a
  Workflow there and run one durable Session across extension surfaces.
- Pause, resume, stop and restore Sessions using timestamp-derived timing and
  one-second authoritative Phase transitions.
- Configure optional weighted Reward Dice with click-to-roll mixing and a
  mandatory Continue step before the next Phase.
- Store local Assets in IndexedDB and preferences in `chrome.storage.local`.
- Import and export versioned Workflow and Settings packages.

Flowarium makes no network requests, requests no host permissions and does not
include content scripts. MVP data remains in the local Chrome profile unless the
user explicitly exports it.

Click the Flowarium toolbar action to open the focus tab. With no active Session,
choose and start an existing Workflow there. The side panel remains available as
a compact Workflow Library and Session controller, and configuration opens in a
regular Options tab. While the focus tab remains open and loaded, Phase changes
and Reward Dice results provide short, non-blocking audio cues. If Chrome blocks
audio for a restored Session, use the visible **Enable sounds** control once.

## Requirements

- Node.js 22
- pnpm 10.14
- Current stable Chrome (Chrome 141 or newer is required for programmable side
  panel closing)

## Development

```bash
pnpm install
pnpm dev
```

WXT writes the development extension to `.output/chrome-mv3-dev`. In Chrome,
open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and
select that directory. Reload the extension from the same page after rebuilding.

Create a production MV3 bundle with:

```bash
pnpm build
```

The unpacked production extension is written to `.output/chrome-mv3`.

## Verification

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

The E2E command builds the extension and launches Playwright's pinned Chromium
with an isolated temporary profile. Install that browser once with:

```bash
pnpm exec playwright install chromium
```

## Architecture

The extension is organized around Workflow, Session, Asset and Settings
features. Domain and application code remain independent of React, browser APIs,
Dexie and WXT. The MV3 background service worker is authoritative for active
Session transitions; each UI context holds only an ephemeral validated
projection. Timing is derived from persisted epoch anchors rather than intervals.

Start with the [documentation hub](docs/README.md) for the Concept reading order,
accepted architectural decisions and developer documentation paths.

Open side-panel and idle focus Workflow lists refresh automatically after
successful catalog changes in another extension surface. Active Sessions remain
bound to the immutable Workflow snapshot captured when they started.
