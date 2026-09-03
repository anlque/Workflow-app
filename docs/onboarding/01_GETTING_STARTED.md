# Getting Started

> **Pre-release data reset:** the Locusora identity build opens a fresh local
> IndexedDB database. Export any developer data that must be retained before
> reloading the unpacked extension. The application does not migrate or delete
> data belonging to the previous pre-release identity; remove it manually from
> Chrome's extension details or DevTools **Application** storage when it is no
> longer needed.

This guide takes a clean checkout to a locally loaded Locusora extension and
explains which artifact each command produces.

## What You Will Run

Locusora is a Chrome Manifest V3 extension built by WXT. Local development uses
two distinct unpacked extensions:

| Build | Directory | Use |
| --- | --- | --- |
| Development | `.output/chrome-mv3-dev` | Watched development build served by the running WXT process |
| Production | `.output/chrome-mv3` | Self-contained build used by Playwright and production checks |

Do not edit either directory. WXT regenerates both from `entrypoints/`, `src/`
and `wxt.config.ts`.

## Prerequisites

- Node.js 22 is the project reference version.
- pnpm 10.14 is pinned by `packageManager` in `package.json`.
- Chrome 141 or newer is required by the project's programmable side-panel
  closing behavior.

Check the active tools:

```bash
node --version
pnpm --version
```

The expected pnpm major and minor version are `10.14`. Later Node versions may
work, but Node 22 is the documented development and CI baseline.

If pnpm is unavailable and Node was installed with Corepack, enable the pinned
package manager:

```bash
corepack enable
corepack pnpm --version
```

## Install

From the repository root:

```bash
pnpm install
```

The install uses `pnpm-lock.yaml`. Its `postinstall` script runs `wxt prepare`,
which creates WXT-generated TypeScript support under `.wxt/`. It does not create
a loadable extension build.

## Development Extension

Start the watched development build:

```bash
pnpm dev
```

Keep this process running while using the development extension. Its first
successful build creates `.output/chrome-mv3-dev` and starts WXT's local
development server.

The development manifest intentionally differs from production. WXT adds a
localhost host permission, a `scripting` permission and reload infrastructure so
the generated pages can communicate with the development server. These are
build-tool permissions, not Locusora production permissions.

## Production Extension

Create a self-contained production build:

```bash
pnpm build
```

The command writes `.output/chrome-mv3`. Its manifest contains the Locusora MVP
permissions:

- `sidePanel` for opening and closing the side panel;
- `storage` for application Settings;
- `alarms` for Session deadline wake-up signals;
- `tabs` for finding, opening and activating the focus tab.

The production build declares no host permissions and performs no network
requests.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `.output/chrome-mv3-dev` while `pnpm dev` is running, or choose
   `.output/chrome-mv3` after `pnpm build`.
5. Pin Locusora to the toolbar if you want direct access to its action.

Load the selected build directory itself, not `.output` and not the repository
root. Chrome reads the `manifest.json` inside that directory.

Use the **Reload** action on `chrome://extensions` after rebuilding a production
bundle. During development, WXT reloads supported changes; reload the extension
manually if Chrome retains an old background worker, manifest or extension page.

## What Each Surface Does

| Surface | How to reach it | Responsibility |
| --- | --- | --- |
| Focus view | Click the Locusora toolbar action or **Open focus view** in the side panel | Select a Workflow when idle and display the full active Session environment |
| Side panel | Use Chrome's extension side-panel control or the focus-view button | Compact Workflow Library and mirrored Session controls |
| Options page | Open Locusora details → **Extension options**, or use an in-product settings action | Workflow editing, local Assets and application Settings |
| Background worker | Inspect the service worker from `chrome://extensions` | Authoritative Session commands, persistence reconciliation and alarms |

The focus view is an extension application hosted in a normal browser focus tab.
The side panel and Options page are separate extension documents. They do not
share React state or JavaScript memory.

## Verification Commands

Run the checks from the repository root:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

| Command | Evidence produced |
| --- | --- |
| `pnpm format:check` | All tracked and visible files match Prettier formatting |
| `pnpm typecheck` | Strict TypeScript compilation completes without emitting files |
| `pnpm lint` | ESLint and architectural import restrictions report no violations |
| `pnpm test` | Vitest unit, component, repository and architecture tests pass |
| `pnpm build` | WXT creates the production extension in `.output/chrome-mv3` |
| `pnpm test:e2e` | The production build completes and Playwright runs extension journeys in isolated Chromium profiles |

Install Playwright's pinned Chromium once before the first E2E run:

```bash
pnpm exec playwright install chromium
```

The E2E command always rebuilds the extension before launching tests.

## Common Setup Failures

### `.output/chrome-mv3-dev` does not exist

Run `pnpm dev` and wait for WXT to report its first successful build. `pnpm
install` prepares WXT types but does not build the extension.

### Development pages are blank after stopping the terminal process

The development extension depends on WXT's local server. Restart `pnpm dev`,
then reload the extension from `chrome://extensions`.

### Chrome reports that no manifest can be found

Select `.output/chrome-mv3-dev` or `.output/chrome-mv3` directly. The parent
`.output` directory contains multiple builds and is not an extension root.

### Chrome shows behavior from an earlier build

Use **Reload** for Locusora on `chrome://extensions`, then reopen the affected
extension page. For background behavior, open the service-worker inspector and
confirm that the current worker started without an initialization error.

### Playwright cannot find Chromium

Run:

```bash
pnpm exec playwright install chromium
```

Then repeat `pnpm test:e2e`.

### A restored Session has no UI sounds

Chrome may keep Web Audio locked until a user gesture. Use **Enable sounds** in
the focus view. Audio cues are local UI feedback and require the focus tab to
remain loaded.

## Next Reading

- Return to the [documentation hub](../README.md).
- Read the [Product Specification](../concepts/01_PRODUCT_SPECIFICATION.md) for
  implemented MVP behavior.
- Read the [Architecture](../concepts/03_ARCHITECTURE.md) and
  [ADR index](../adr/README.md) before changing module boundaries.
