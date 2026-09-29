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

`OptionsApp` is a thin fallback wrapper for Chrome's manifest options page. A
future Focus overlay may host the same Studio with its own dependency factory,
but the shared Studio must not import Focus-owned modules or control its host's
overlay, document lifecycle or navigation. An architecture test enforces that
dependency direction for alias and relative imports.

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

There is one owner for all three configuration sections and one contract for
their dependencies. The options fallback preserves its entrypoint and browser
lifecycle while carrying almost no presentation state. Hosting surfaces must
adapt their concrete dependencies to the shared interface, and changes to that
interface affect every host. Focus embedding, overlay interaction and animation
remain separate work.

## Related Documents

- ADR-0002
- ADR-0008
- `docs/development/PROJECT_MAP.md`
- `docs/development/RUNTIME_AND_NAVIGATION.md`

## Supersedes

None.
