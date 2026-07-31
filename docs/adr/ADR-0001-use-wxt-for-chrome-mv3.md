# ADR-0001

Use WXT for the Chrome Manifest V3 MVP

Status: Accepted

Date: 2026-07-31

---

## Context

Flowarium needs multiple browser-extension entry points, Manifest generation,
development reloads and production packaging. Maintaining this build
infrastructure directly would not add product value. The MVP needs one supported
runtime before cross-browser support is attempted.

## Decision

Target current stable Chrome with Manifest V3 for the MVP and use WXT as the
extension framework over Vite. Implement a side panel, options page, background
service worker and full-page focus view. Keep WXT entry points thin and delegate
composition to `src/app`. Do not add a popup or content scripts until a product
requirement needs them.

## Alternatives Considered

- Custom Vite configuration: maximum control, but substantial extension-specific
  build and reload maintenance.
- CRXJS: smaller abstraction, but less complete project and packaging support.
- Plasmo: capable, but more framework-owned application structure than required.

## Consequences

The project gains established extension tooling and a clear MVP target. It accepts
WXT conventions and a third-party framework dependency. Browser-specific APIs
must remain behind Platform adapters so later targets do not alter Domain or
Application code.

## Related Documents

- `docs/concepts/01_PRODUCT_SPECIFICATION.md`
- `docs/concepts/06_TECH_STACK.md`

