# Architectural Decision Records

Only records with `Accepted` status define the current architecture. Historical
records remain available if they are later Superseded or Archived.

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-0001](ADR-0001-use-wxt-for-chrome-mv3.md) | Accepted | Use WXT for the Chrome Manifest V3 MVP |
| [ADR-0002](ADR-0002-feature-first-clean-architecture.md) | Accepted | Adopt Feature-First Clean Architecture |
| [ADR-0003](ADR-0003-workflow-aggregate-session-snapshot.md) | Accepted | Use a Workflow Aggregate and immutable Session snapshot |
| [ADR-0004](ADR-0004-authoritative-session-execution.md) | Accepted | Coordinate authoritative Session execution in the background |
| [ADR-0005](ADR-0005-local-first-persistence.md) | Accepted | Use local-first persistence with Dexie and Chrome Storage |
| [ADR-0006](ADR-0006-local-asset-lifecycle.md) | Accepted | Store and manage local Assets explicitly |
| [ADR-0007](ADR-0007-versioned-import-export.md) | Accepted | Use versioned and atomic import and export |
| [ADR-0008](ADR-0008-browser-integration-boundaries.md) | Accepted | Place browser integrations according to architectural ownership |
| [ADR-0009](ADR-0009-minimal-shared-kernel.md) | Accepted | Keep a minimal Shared Kernel for cross-feature identity |
| [ADR-0010](ADR-0010-indexeddb-schema-composition.md) | Accepted | Compose one IndexedDB schema from feature-owned fragments |

Create and evolve records according to
[`docs/concepts/09_ADR_GUIDELINES.md`](../concepts/09_ADR_GUIDELINES.md).
