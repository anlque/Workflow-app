# Add an Extension Surface

## Use When

Use this recipe only when an accepted product capability requires a new
independent extension document or runtime context. Current MVP surfaces are
focus, side panel, Options and background. Popup, onboarding or another page is
future scope until the Product Specification is deliberately changed.

A new panel inside an existing React document is not a new extension surface.

## Before Editing

1. Define the user journey, responsibility and why an existing surface cannot
   own it without losing cohesion.
2. Update MVP/future scope in the
   [Product Specification](../../concepts/01_PRODUCT_SPECIFICATION.md).
3. Decide whether the surface introduces a durable architectural/runtime choice.
   If so, create a Proposed ADR under the
   [ADR guidelines](../../concepts/09_ADR_GUIDELINES.md) before implementation.
4. Read [ADR-0001](../../adr/ADR-0001-use-wxt-for-chrome-mv3.md),
   [ADR-0008](../../adr/ADR-0008-browser-integration-boundaries.md) and
   [Runtime and Navigation](../RUNTIME_AND_NAVIGATION.md).
5. List the state it displays or changes and identify the existing authority for
   each value. A new surface does not become a second authority.
6. Determine required Chrome permissions from concrete browser calls. Default to
   no new permission and no host permission.

## Likely Owners

| Concern                                    | Owner                                                    |
| ------------------------------------------ | -------------------------------------------------------- |
| WXT discovery HTML/main or worker file     | `entrypoints/<surface>/` or `entrypoints/<surface>.ts`   |
| React bootstrap and lifecycle cleanup      | `src/app/<surface>/bootstrap*.tsx`                       |
| Dependency construction/browser navigation | `src/app/<surface>/create*Dependencies.ts`               |
| Surface shell                              | `src/app/<surface>/*App.tsx`                             |
| Reusable business UI/behavior              | owning feature Presentation/Application through root API |
| Generic Chrome capability                  | `src/platform/` when reusable and business-independent   |
| Surface-only browser lifecycle             | narrow adapter in `src/app/`                             |
| Manifest permission/action                 | `wxt.config.ts`                                          |
| Shared visual tokens                       | `src/styles/global.css` / Shared UI                      |
| Built URL fixture                          | `tests/e2e/extensionFixture.ts`                          |

WXT entrypoints remain thin adapters. They import global styles and delegate to
one `src/app` bootstrap; they never coordinate feature use cases.

## Ordered Steps

1. Add the product/ADR decision and an initial E2E loading assertion that names
   the expected generated extension URL.
2. Create `entrypoints/<surface>/index.html` with a semantic title and one root,
   plus `main.tsx` that imports the matching bootstrap and global stylesheet.
   Use the established PascalCase/camelCase filename convention for source
   symbols; do not copy generated `.output` files.
3. Add `bootstrap<Surface>()`. Reject a missing root, create dependencies once,
   render under `StrictMode` and register cleanup for listeners, media, object
   URLs or other owned resources.
4. Define a small dependency object for the App component. Presentation receives
   data/actions, not repositories, Dexie or raw Chrome APIs.
5. Build the dependency factory from feature root APIs and Platform/app adapters.
   Include the complete IndexedDB schema fragments if the surface can open the
   shared database.
6. Add browser adapters at the owner selected by ADR-0008. A reusable capability
   belongs in Platform; feature-port implementation belongs in Infrastructure;
   surface navigation/lifecycle may remain in `app`.
7. Add runtime messages only for cross-context intent or projection. Follow
   [Add a Runtime Message](ADD_RUNTIME_MESSAGE.md) and preserve hydration after
   missed events.
8. Add only the manifest permission required by an implemented browser call.
   Document its purpose and extend the production manifest E2E assertion.
9. Implement the surface shell with semantic HTML, keyboard operation, focus
   visibility, loading/empty/error states and reduced-motion behavior.
10. Add semantic CSS consistent with current design tokens. Verify constrained
    dimensions if Chrome, rather than a normal tab, owns the container.
11. Add the generated page path to `ExtensionUrls` in
    `tests/e2e/extensionFixture.ts` and an assembled critical journey if the
    surface changes one.
12. Verify development and production artifacts separately:
    `.output/chrome-mv3-dev` is watched and server-dependent;
    `.output/chrome-mv3` is self-contained and used by Playwright.
13. Manually verify browser-shell behavior that direct extension URLs cannot
    reproduce.

Flowarium uses separate extension documents, not React Router routes. Each
surface has its own React root, JavaScript memory and projection lifecycle.

## Compatibility Checks

- **State authority:** can the surface hydrate after opening late or missing an
  event?
- **Memory isolation:** does no code assume a Zustand store is shared with other
  contexts?
- **Database schema:** if opened, does it use the identical complete fragment
  history?
- **Permissions:** is each new permission required, documented and verified;
  are host permissions still absent unless product scope explicitly changes?
- **Navigation:** do open/activate semantics avoid duplicate focus-like tabs?
- **Cleanup:** are runtime listeners, object URLs, timers and audio disposed?
- **Accessibility:** is the surface keyboard-operable and WCAG 2.2 AA-oriented?
- **Builds:** are development-server dependencies not mistaken for production
  behavior?
- **Testing boundary:** is native browser-shell behavior manually covered when
  direct Playwright URLs cannot reproduce it?

## Tests

Add, in order:

```bash
pnpm vitest run src/app/<surface>
pnpm vitest run tests/architecture/importBoundaries.test.ts
pnpm build
pnpm exec playwright test tests/e2e/accessibility.spec.ts
```

Expected proof:

- bootstrap rejects a missing root and renders with injected dependencies;
- dependency adapter calls/cleanup are testable without the Chrome shell;
- App shell covers loading, empty, error and primary interaction states;
- message producer/consumer validation is tested on both sides;
- generated production page loads by extension URL;
- accessibility, performance target and manifest permissions remain valid;
- browser-shell-only behavior receives a focused adapter test plus manual check.

Replace `<surface>` with the real directory; it is notation, not a literal path.

## Documentation Impact

Update:

- Product Specification and, if applicable, a new ADR;
- [Runtime and Navigation](../RUNTIME_AND_NAVIGATION.md);
- [Project Map](../PROJECT_MAP.md) and [Runtime Model](../../onboarding/03_RUNTIME_MODEL.md);
- [State and Data Flow](../STATE_AND_DATA_FLOW.md) and
  [Runtime Messaging](../MESSAGING.md);
- [Getting Started](../../onboarding/01_GETTING_STARTED.md) for how to reach it;
- Playwright fixture boundaries in [Testing and Debugging](../TESTING_AND_DEBUGGING.md);
- documentation hub and any affected flow.

## Stop and Reconsider If

- the surface duplicates responsibility already cohesive elsewhere;
- it is future scope without an accepted product change;
- business logic is being placed in WXT entrypoint or `src/app`;
- a feature Presentation module would access browser APIs directly;
- a broad permission or host access is requested speculatively;
- cross-context state depends on shared JavaScript memory;
- a deep import is used to avoid a feature public API;
- Playwright direct-page success is being treated as proof of native toolbar or
  side-panel-container behavior.
