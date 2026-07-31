# ADR-0005

Use Local-First Persistence with Dexie and Chrome Storage

Status: Accepted

Date: 2026-07-31

---

## Context

Core functionality must work without an account or network connection. The
project stores relational records, binary Assets, active execution state and a
small set of extension preferences.

## Decision

Local persistence is authoritative. Use Dexie over IndexedDB for Workflows,
active and historical Sessions, Asset metadata and Asset blobs. Use
`chrome.storage.local` for theme, reduced-motion preference and last selected
Workflow. Application defines repository ports and Infrastructure owns records,
runtime validation, mappers, transactions and ordered migrations.

Persist only source facts. Derived timer values are recomputed from timing
anchors. No network fallback or synchronization exists in the MVP.

## Alternatives Considered

- Raw IndexedDB: avoids a dependency, but adds verbose transaction and migration
  infrastructure.
- `chrome.storage.local` for all data: unsuitable for relational and binary data.
- Cloud-first storage: violates offline operation and local ownership.

## Consequences

The MVP is usable offline and storage technologies remain replaceable behind
ports. Two stores require explicit ownership and backup behavior. Every schema
change needs a migration and boundary validation.

## Related Documents

- `docs/concepts/00_PROJECT_MANIFESTO.md`
- `docs/concepts/06_TECH_STACK.md`

