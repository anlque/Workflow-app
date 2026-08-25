# Add or Change a Runtime Message

## Use When

Use this recipe when isolated extension contexts need a new intent-based command,
request or event, or when an existing runtime envelope changes. Read the complete
[Runtime Messaging catalog](../MESSAGING.md) first.

Do not introduce a message when the behavior is local to one document, or when a
payload-free invalidation plus repository reload already solves synchronization.

## Before Editing

1. Identify sender, receiver, authority and resulting state change using
   [State and Data Flow](../STATE_AND_DATA_FLOW.md).
2. Classify the contract:
   - **command** mutates authoritative state and needs a unique `commandId`;
   - **request** reads/reconciles authority and needs a request identifier;
   - **event** announces an authoritative projection or invalidation and has no
     command response.
3. Name business intent (`session/continue-reward`), not a receiver function or
   transport mechanism.
4. Decide who owns runtime parsing and the handler. Apply
   [ADR-0008](../../adr/ADR-0008-browser-integration-boundaries.md): Platform
   owns reusable transport, feature Infrastructure owns feature ports, and
   `app` owns surface/coordinator composition.
5. Determine failure, retry and idempotency semantics before adding the type.

## Likely Owners

| Concern                            | Current owner                                       |
| ---------------------------------- | --------------------------------------------------- |
| Message declaration                | `src/platform/messaging/RuntimeMessage.ts`          |
| Exact runtime input parser         | `src/platform/messaging/runtimeMessageSchema.ts`    |
| Generic Chrome command/request bus | `ChromeMessageBus.ts` and `RuntimeMessageBus.ts`    |
| Catalog invalidation adapter       | `ChromeWorkflowCatalogEvents.ts`                    |
| Session sender/response validation | `src/app/session/ChromeSessionClient.ts`            |
| Authoritative command routing      | `src/app/background/createSessionCoordinator.ts`    |
| Presentation hydration/replacement | Session store connection or feature hook            |
| Runtime composition                | relevant `src/app/<surface>/create*Dependencies.ts` |

Features consume another feature only through its public API. Presentation
receives an injected client/callback and never calls `browser.runtime` directly.

## Ordered Steps

1. Write a failing parser test with a valid envelope plus non-object, missing,
   empty, extra-key and wrong-type cases.
2. Add the discriminated declaration to `RuntimeMessage.ts`. Use `unknown` for
   runtime payloads until their receiving boundary reconstructs a trusted value.
3. Add/update the parser. Commands, requests and catalog invalidations require
   exact keys and non-empty identifiers. If an existing event intentionally uses
   looser top-level filtering, preserve or deliberately revise both producer and
   consumer tests.
4. Register the parser in the owning bus/event adapter. A listener must ignore a
   message owned by another contract without corrupting state or sending a false
   response.
5. Add the producer method. Generate one new identifier per new user intent;
   retries of that same intent reuse its command identifier only when the caller
   owns such retry semantics.
6. Validate `{ ok: true, result } | { ok: false, error }` on the client. Then
   validate a successful nested projection; compile-time typing is insufficient.
7. Route the message in the background/app coordinator to an Application use
   case. Keep Domain transitions and persistence outside the transport adapter.
8. For a state mutation, persist first, then publish the authoritative
   `session/changed` projection or a payload-free catalog invalidation according
   to the existing flow.
9. Add/update projection replacement in the consuming document. Avoid patching a
   local copy when authority can send/reload the complete value.
10. Register the adapter in every required composition root and return cleanup
    for subscriptions.
11. Update the message catalog and every cross-cutting flow whose sequence or
    failure behavior changed.

## Compatibility Checks

- **Exact keys:** are producer and parser updated atomically?
- **Listener coexistence:** will unrelated listeners ignore the new type?
- **Response channel:** does an asynchronous Chrome handler keep it open and
  always normalize success/failure?
- **Idempotency:** commands have a `commandId`; document whether deduplication is
  only in-memory for the current service-worker lifetime.
- **Projection:** is every received Domain-looking value still parsed from
  `unknown`?
- **Ordering:** is persistence committed before a success broadcast?
- **Missed event recovery:** can a new/reopened document hydrate/reload from
  durable authority?
- **Permission scope:** does the message use existing runtime capability without
  expanding manifest permissions?
- **No payload duplication:** would an invalidation be safer than transporting a
  second mutable catalog?

## Tests

Run both sides of the boundary:

```bash
pnpm vitest run src/platform/messaging src/app/session src/app/background
```

Expected proof:

- exact parser acceptance/rejection;
- producer envelope and unique identifier;
- response and nested projection validation;
- bus routing and normalized errors;
- coordinator use-case call, persistence/publication ordering and command
  deduplication;
- subscriber replacement, cleanup and malformed-event behavior;
- an E2E update only when the critical cross-context journey changes.

## Documentation Impact

Update:

- [Runtime Messaging](../MESSAGING.md) as the exact catalog;
- [State and Data Flow](../STATE_AND_DATA_FLOW.md) when ownership changes;
- the relevant execution flow under [`flows/`](../flows/);
- [Runtime and Navigation](../RUNTIME_AND_NAVIGATION.md) if a surface begins
  producing/consuming the contract;
- Concepts/ADR when authority, runtime topology or browser-integration ownership
  changes.

Normative dependency direction remains in
[Architecture](../../concepts/03_ARCHITECTURE.md) and
[Folder Structure](../../concepts/04_FOLDER_STRUCTURE.md).

## Stop and Reconsider If

- the message is named after a function, component or generic operation;
- a Domain object is trusted because the sender is TypeScript;
- Presentation would import the Chrome bus or another feature's internal module;
- two documents would become competing authorities for the same state;
- a command lacks explicit failure/idempotency behavior;
- an event payload duplicates a catalog that can be reloaded;
- message validation is skipped to make an integration pass;
- a new permission is added without product need and architectural review.
