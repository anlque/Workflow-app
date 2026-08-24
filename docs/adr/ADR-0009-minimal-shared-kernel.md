# ADR-0009

Keep a Minimal Shared Kernel for Cross-Feature Identity

Status: Accepted

Date: 2026-08-24

---

## Context

Workflow Environments reference Assets without owning them. Both the Workflow
and Assets features therefore need the same branded `AssetId` type. Placing the
type inside either feature makes the other feature depend on that feature for a
contract whose meaning is shared at their boundary. Duplicating the brand would
create incompatible identities for one concept.

The general architecture correctly prohibits using `shared` as a home for
business entities or rules. It needs a narrow rule for a contract that genuinely
belongs to more than one feature.

## Decision

Allow a minimal Shared Kernel under `src/shared/domain/` for cross-feature
identity contracts. `AssetId` is the only current member.

A Shared Kernel type must:

- represent exactly one concept used by multiple independent features;
- have identical semantics in every consumer;
- contain no entity lifecycle, business rule, persistence shape or framework
  dependency;
- be exported through the intentional `src/shared/index.ts` public API;
- remain small enough to review as an explicit coupling contract.

Feature-owned entities, constructors, validation and use cases remain in their
features. Reuse alone does not qualify a type for the Shared Kernel. Adding
another business-specific contract requires an architectural review of its
owner before changing `src/shared/domain/`.

## Alternatives Considered

- Assets owns `AssetId`, and Workflow imports the Assets public API: clear entity
  ownership, but adds a feature dependency for the shared reference contract.
- Workflow owns a separate Asset reference string: avoids the dependency, but
  loses type identity across the boundary.
- Use unbranded strings: simplest representation, but permits accidental
  substitution with unrelated identifiers.

## Consequences

Workflow and Assets share one type without sharing entity behavior or internal
modules. The exception weakens the absolute rule that no business-named type may
exist in `shared`, so the eligibility criteria must remain narrow. The Shared
Kernel must never become a generic collection of convenient application types.

## Related Documents

- `docs/adr/ADR-0002-feature-first-clean-architecture.md`
- `docs/adr/ADR-0006-local-asset-lifecycle.md`
- `docs/concepts/02_DOMAIN_MODEL.md`
- `docs/concepts/04_FOLDER_STRUCTURE.md`
