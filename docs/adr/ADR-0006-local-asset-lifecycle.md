# ADR-0006

Store and Manage Local Assets Explicitly

Status: Accepted

Date: 2026-07-31

---

## Context

Workflows reuse local background images and ambient audio. Binary ownership,
browser quotas, references and export behavior must be explicit to prevent broken
Workflows or leaked object URLs.

## Decision

The MVP accepts local images and audio only. Store metadata and blobs in
IndexedDB through the Assets feature. Validate supported MIME type, non-empty
content and configurable size limits before persistence. Environment stores Asset
identifiers, never blobs. Reject deletion while any Workflow references an Asset.
Presentation creates object URLs through an Asset URL service and revokes them
when their consumer releases them.

Workflow export embeds referenced Assets. Remote providers, video, animation and
automatic orphan deletion are future scope.

## Alternatives Considered

- Embed blobs in Workflows: duplicates data and prevents reuse.
- Store data URLs: increases size and memory overhead.
- Cascade delete references: silently damages Workflow configuration.

## Consequences

Assets remain reusable and deletion is safe. Reference checks and quota errors
must be surfaced to users. Export packages can be large and must be validated
before import writes begin.

## Related Documents

- `docs/concepts/01_PRODUCT_SPECIFICATION.md`
- `docs/concepts/02_DOMAIN_MODEL.md`

