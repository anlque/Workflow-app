# ADR-0002

Adopt Feature-First Clean Architecture

Status: Accepted

Date: 2026-07-31

---

## Context

The project needs business-oriented modules without allowing React, Chrome APIs
or storage technologies to control the Domain. Earlier diagrams left runtime
flow and source dependency direction ambiguous.

## Decision

Organize code by business feature, with Domain, Application, Infrastructure and
Presentation layers only where needed. Domain has no outward dependencies.
Application depends on Domain and owns ports required by use cases.
Infrastructure implements those ports. Presentation invokes Application and
never imports concrete Infrastructure. `app` is the composition root and injects
adapters. Features expose intentional root public APIs; cross-feature deep imports
and circular dependencies are prohibited.

The initial features are `workflow`, `session`, `assets` and `settings`. Workflow
owns Phase, Environment, Reward Dice and the Workflow Library collection.

## Alternatives Considered

- Technical top-level layers: simpler initially, but weak feature ownership.
- Feature-Sliced Design: comprehensive, but excessive structure for this MVP.
- Unlayered feature modules: lower ceremony, but insufficient protection around
  persistence and browser boundaries.

## Consequences

Business behavior remains independently testable and infrastructure replaceable.
The cost is explicit ports, mapping and composition. Boundary rules should be
enforced by ESLint and dependency tests rather than convention alone.

## Related Documents

- `docs/concepts/03_ARCHITECTURE.md`
- `docs/concepts/04_FOLDER_STRUCTURE.md`

