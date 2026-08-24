# ADR-0008

Place Browser Integrations According to Architectural Ownership

Status: Accepted

Date: 2026-08-24

---

## Context

ADR-0001 requires browser-specific behavior to remain behind adapters. Flowarium
has three distinct kinds of browser integration: reusable technical capabilities
such as alarms and runtime messaging, feature-specific persistence such as
Settings in `chrome.storage.local`, and surface-specific navigation such as
opening the Options page, focus tab or side panel.

Requiring every browser call to live under `platform` would move
feature-specific ownership into a generic module and create wrappers that add no
boundary. Allowing browser calls anywhere would couple Domain, Application and
Presentation code to Chrome and WXT.

## Decision

Browser and WXT APIs may be imported only by:

- reusable, business-independent adapters in `src/platform/`;
- feature-specific adapters in a feature's `infrastructure/` layer;
- narrow surface lifecycle, navigation and composition adapters in `src/app/`;
- thin WXT entrypoints that delegate immediately to `src/app/`.

Domain and Application never import browser or WXT APIs. Presentation receives
browser-dependent behavior through injected functions or stable interfaces and
does not import those APIs directly.

Platform owns generic capabilities that can serve several features or runtime
contexts. Feature Infrastructure owns technology-specific implementations of a
feature's Application ports. `app` owns browser behavior whose meaning exists
only while composing or navigating a particular extension surface.

Every allowed adapter must provide at least one real boundary: type-safe
contracts, runtime isolation, validation, normalization, lifecycle handling or
testability. A wrapper that only renames a stable API is not required.

## Alternatives Considered

- Put all browser calls in Platform: one obvious technical location, but weak
  feature and surface ownership plus many pass-through wrappers.
- Allow browser calls throughout Infrastructure and Presentation: fewer files,
  but browser coupling leaks into UI behavior and becomes difficult to test.
- Use browser APIs only in WXT entrypoints: maximum isolation, but turns entrypoints
  into large composition and orchestration modules.

## Consequences

Stable business layers remain browser-independent while adapters stay close to
the responsibility they implement. Import-boundary enforcement must distinguish
Presentation from `app` composition instead of prohibiting every browser import
outside Platform. Cross-browser work may require replacing adapters in several
owners, but it does not require changing Domain or Application behavior.

This record clarifies the browser-adapter consequence of ADR-0001 without
superseding its WXT and Chrome Manifest V3 decision.

## Related Documents

- `docs/adr/ADR-0001-use-wxt-for-chrome-mv3.md`
- `docs/adr/ADR-0002-feature-first-clean-architecture.md`
- `docs/concepts/03_ARCHITECTURE.md`
- `docs/concepts/04_FOLDER_STRUCTURE.md`
