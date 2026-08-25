# Workflow Catalog Synchronization Flow

## Trigger

A Workflow catalog mutation succeeds in Options or side panel: create, update,
duplicate, delete, reorder or package import.

## Preconditions

- The mutation is composed through
  [`runWorkflowCatalogMutation()`](../../../src/app/runWorkflowCatalogMutation.ts).
- Focus and side-panel catalogs use `useWorkflowCatalog()` with a Workflow
  repository list function and `workflow/catalog-changed` subscription.
- Every document has its own repository and React state; no in-memory store is
  shared across extension documents.

## Sequence

1. A Presentation callback invokes its `src/app` dependency.
2. The dependency calls the owning Workflow Application use case inside
   `runWorkflowCatalogMutation()`.
3. The use case and repository validate and commit the mutation. If this rejects,
   the wrapper stops and publishes no event.
4. After success, [`ChromeWorkflowCatalogEvents`](../../../src/platform/messaging/ChromeWorkflowCatalogEvents.ts)
   sends the payload-free exact message `{ type: 'workflow/catalog-changed' }`.
5. Each `useWorkflowCatalog()` subscribed in focus or side panel treats the
   message only as invalidation and calls its injected `list()` source.
6. The hook subscribes before its initial load, so a mutation during startup is
   not silently missed. It queues another pass when invalidation arrives during
   an in-flight reload, coalescing repeated signals without parallel list races.
7. A successful reload replaces that document's Workflow list and clears its
   refresh error.
8. A failed reload preserves the last valid list and exposes `refreshError`.
   Later invalidation or manual `reload()` retries against IndexedDB.
9. Options does not use this hook for its workspace snapshot. After its own
   operations it explicitly calls `load()`; other documents learn about
   Workflow changes through the event.

Current wrapped mutations:

- Options: create/update save, duplicate, delete, reorder and Workflow import;
- side panel: create, duplicate, delete and reorder.

Opening a Workflow only updates Settings and opens Options, so it is not a
catalog mutation. Asset and Settings changes do not publish this event.

## Authoritative Changes

- IndexedDB Workflow rows/order are authoritative and change before the event.
- The event carries no Workflow value, patch, ID or version.
- Each document replaces its local list only after reading and validating the
  repository.
- An active Session snapshot never changes. Workflow edit, deletion or import
  affects only future Sessions.

## Messages

`workflow/catalog-changed` is a payload-free broadcast. Its schema requires the
single exact `type` key. Unknown or malformed messages are ignored by the
catalog adapter and cannot become a catalog value.

This event is intentionally separate from authoritative `session/changed`
projections. See [Runtime Messaging](../MESSAGING.md).

## Persistence

The mutation commits through `DexieWorkflowRepository` or the Workflow/Assets
package transaction before publication. Subscribers always reload IndexedDB;
there is no automatic browser-account synchronization, remote cache or shared
cross-document memory.

## Failure and Recovery

| Failure                          | Observable result                                                | Recovery                                                                                          |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Mutation rejects                 | Initiating UI shows failure; no invalidation is published        | Correct the mutation/input/storage failure and retry                                              |
| Publication rejects after commit | Caller sees failure although IndexedDB already changed           | Reload the initiating/other documents; a later successful mutation publishes another invalidation |
| Subscriber reload rejects        | Last valid catalog stays visible with refresh error              | Retry through later invalidation/manual reload; inspect record/storage failure                    |
| Several events arrive together   | One reload runs and a queued pass follows if needed              | Expected coalescing behavior                                                                      |
| Document mounts during mutation  | Subscribe-before-load plus queued reload closes the startup race | No payload replay is required                                                                     |
| Active Session uses old Workflow | Expected immutable snapshot behavior                             | Start a new Session to use the edited Workflow                                                    |

## Proof in Tests

- publish-after-success/no-publish-on-failure:
  `src/app/runWorkflowCatalogMutation.test.ts`.
- exact event schema and Chrome adapter:
  `src/platform/messaging/runtimeMessageSchema.test.ts` and
  `ChromeWorkflowCatalogEvents.test.ts`.
- subscription/load race, coalescing and error retention:
  `src/features/workflow/presentation/useWorkflowCatalog.test.tsx`.
- app composition: `src/app/options/OptionsApp.test.tsx`,
  `src/app/side-panel/SidePanelApp.test.tsx` and
  `src/app/focus/FocusApp.test.tsx`.

Run focused proof with:

```bash
pnpm vitest run src/app/runWorkflowCatalogMutation.test.ts src/platform/messaging src/features/workflow/presentation/useWorkflowCatalog.test.tsx
```

## Related Concepts and ADRs

- [Architecture](../../concepts/03_ARCHITECTURE.md)
- [Technology Stack](../../concepts/06_TECH_STACK.md)
- [ADR-0002: Feature-First Clean Architecture](../../adr/ADR-0002-feature-first-clean-architecture.md)
- [ADR-0004: Authoritative Session Execution](../../adr/ADR-0004-authoritative-session-execution.md)
- [State and Data Flow](../STATE_AND_DATA_FLOW.md)
- [Workflow Feature](../features/WORKFLOW.md)
