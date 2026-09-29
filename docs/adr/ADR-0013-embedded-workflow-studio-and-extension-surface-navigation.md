# ADR-0013

Embedded Workflow Studio and extension-surface navigation

Accepted

2026-09-28

---

## Context

Workflow editing, Asset management and Settings were assembled directly by the
Chrome options-page component. Embedding that same experience in another
extension surface would either require importing an options-owned composition
or rebuilding its state, loading and error behavior. Extension documents still
need independent lifecycle and navigation ownership.

## Decision

`src/app/workflow-studio/` owns one reusable `WorkflowStudio` composition for
the Workflows, Assets and Settings sections. It owns their local section state,
initial snapshot loading/error boundary and explicit dependency interface.
Concrete repositories, browser adapters and use cases remain supplied by the
hosting surface's composition root.

`OptionsApp` is a thin fallback wrapper for Chrome's manifest options page.
Focus hosts the same Studio in a Focus-owned, full-viewport lazy overlay. The
underlying Focus surface stays mounted and inert while the overlay is open; the
loaded Studio stays mounted after close so its draft survives for the Focus
document lifetime. The shared Studio does not import Focus-owned modules or
control its host's overlay, document lifecycle or navigation. Architecture
tests enforce that dependency direction and the dynamic Focus loading boundary.

The concrete Studio dependency factory and its transactional adapters belong
to `src/app/workflow-studio/` and accept host-owned database, preference and
catalog-event adapters. Options and Focus therefore reuse one composition
without importing each other's surface roots. Focus shares its catalog-event
adapter with the embedded Studio so a same-document mutation refreshes the
underlying launcher as well as other extension documents. Focus dynamically
imports both Studio presentation and concrete composition on first open; they
are absent from its initial module-preload graph.

Section selection remains local React state. Extension surfaces continue to
navigate through injected browser-boundary operations; Locusora does not add a
client-side router or share mutable React state between document roots.

## Alternatives Considered

- Share only a data hook and rebuild the sections per surface: rejected because
  composition and error/loading behavior could drift.
- Let Focus import the stateful Options page: rejected because surface identity
  and navigation would point in the wrong dependency direction.
- Add React Router for Studio sections or extension documents: rejected because
  neither URL history nor route lifecycle is part of the product contract.

## Consequences

There is one owner for all three configuration sections, one concrete Studio
composition and one contract for their dependencies. The options fallback
preserves its entrypoint and browser lifecycle while carrying almost no
presentation state. Focus keeps Session projection, timer and audio ownership
outside the overlay; an active-Session summary is a read-only projection. The
overlay adds document-lifetime draft retention and explicit focus/inert motion
semantics without introducing URL routing or cross-root mutable state.

## Related Documents

- ADR-0002
- ADR-0008
- `docs/development/PROJECT_MAP.md`
- `docs/development/RUNTIME_AND_NAVIGATION.md`

## Supersedes

None.
