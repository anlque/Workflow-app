# Runtime Messaging

Chrome runtime messaging connects isolated extension contexts. Message values
cross the boundary as `unknown`; the receiver validates before invoking trusted
Application or Presentation behavior.

## Message Catalog

The catalog lists every current application runtime message exactly once.

| Message | Direction | Identifier | Payload | Receiver parser and handler | Response | Broadcast | `commandId` idempotency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `session/start` | Focus or side panel → background | Non-empty `commandId`; non-empty `workflowId` | `{ type, commandId, workflowId }` | `parseSessionCommand` → `ChromeMessageBus.onSessionCommand` → coordinator loads Workflow and calls `startSessionUseCase` | `{ ok: true, result: Session }` or `{ ok: false, error: string }`; client validates `result` as Session | Successful change also emits `session/changed` | Yes, within the current worker instance |
| `session/pause` | Focus or side panel → background | Non-empty `commandId`; non-empty `sessionId` | `{ type, commandId, sessionId }` | `parseSessionCommand` → command bus → `pauseSessionUseCase` | Same normalized command response | Successful change also emits `session/changed` | Yes, within the current worker instance |
| `session/resume` | Focus or side panel → background | Non-empty `commandId`; non-empty `sessionId` | `{ type, commandId, sessionId }` | `parseSessionCommand` → command bus → `resumeSessionUseCase` | Same normalized command response | Successful change also emits `session/changed` | Yes, within the current worker instance |
| `session/continue-reward` | Focus view → background | Non-empty `commandId`; non-empty `sessionId` | `{ type, commandId, sessionId }` | `parseSessionCommand` → command bus → `continueRewardSessionUseCase` | Same normalized command response | Successful change also emits `session/changed` | Yes, within the current worker instance |
| `session/stop` | Focus or side panel → background | Non-empty `commandId`; non-empty `sessionId` | `{ type, commandId, sessionId }` | `parseSessionCommand` → command bus → `stopSessionUseCase` | Same normalized command response | Successful change also emits `session/changed` | Yes, within the current worker instance |
| `session/get-active` | Focus or side panel → background | Non-empty `requestId` | `{ type, requestId }` | `parseActiveSessionRequest` → `ChromeMessageBus.onActiveSessionRequest` → `getActiveSessionUseCase` | `{ ok: true, result: Session \| null }` or `{ ok: false, error: string }`; client validates result | No | No; `requestId` identifies the request but is not stored in the command map |
| `session/changed` | Background → extension runtime listeners | None | `{ type, session: unknown }`, where Session may be `null` | `ChromeSessionClient.subscribe` first filters `type`, then `parseSessionProjection` validates the payload before replacing a store | No application response contract | Yes; all contexts may observe it, only Session clients consume it | No |
| `workflow/catalog-changed` | Options or side-panel mutation publisher → extension runtime listeners | None | Exact `{ type }`; no Workflow payload | `parseWorkflowCatalogChangedMessage` in `ChromeWorkflowCatalogEvents.subscribeChanged` → catalog hook reload | No application response contract; publisher only awaits runtime delivery | Yes; focus and side-panel catalogs consume it | No |

The TypeScript message declarations live in
[`RuntimeMessage.ts`](../../src/platform/messaging/RuntimeMessage.ts). Session
command and request transport lives in
[`ChromeMessageBus.ts`](../../src/platform/messaging/ChromeMessageBus.ts).
Workflow catalog invalidation uses the narrower
[`ChromeWorkflowCatalogEvents.ts`](../../src/platform/messaging/ChromeWorkflowCatalogEvents.ts)
adapter.

## Session Command Boundary

`ChromeSessionClient` constructs a command with a freshly generated UUID and
calls `browser.runtime.sendMessage`. The value is still treated as `unknown` by
the background listener.

`parseSessionCommand()` requires:

- an object that is not `null` or an array;
- a supported command `type`;
- a non-empty `commandId`;
- exactly `type`, `commandId` and `workflowId` for `session/start`;
- exactly `type`, `commandId` and `sessionId` for every other command;
- a non-empty target identifier.

Extra properties are rejected. This prevents silently accepting a producer and
consumer that disagree about a contract.

`ChromeMessageBus` ignores messages that fail this parser because another
listener may own them. A valid command keeps the Chrome response channel open,
awaits the coordinator and normalizes the Promise result:

```ts
type RuntimeSuccess = Readonly<{ ok: true; result: unknown }>;
type RuntimeFailure = Readonly<{ ok: false; error: string }>;
```

The client rejects a response that is not an object, has neither valid branch,
or has a non-string failure message. It then passes the successful `result` to
`parseSessionProjection`; compile-time types alone never authorize the payload.

## Command Idempotency

The background coordinator stores the Promise for each `commandId` in
`handledCommands`. Repeating an identifier returns the same in-flight or settled
Promise instead of executing another transition, persistence write or broadcast.

Current scope matters:

- the map exists only for the lifetime of one background worker instance;
- it is not persisted across worker suspension/restart;
- the identifier represents one complete Session command;
- callers generate a new identifier for a new user intent.

Durable Domain and repository invariants still protect state after restart. Do
not describe the in-memory map as persistent exactly-once delivery.

## Active Session Request Boundary

`session/get-active` is a request, not a mutation. Its exact-key parser accepts
only `type` and non-empty `requestId`. The current background handler does not
echo the identifier because Chrome pairs `sendMessage()` with its response
Promise.

`getActiveSessionUseCase` may reconcile elapsed time before returning. Therefore
the response is the authoritative current projection, not a raw record read.

## Session Event Boundary

After initialization, a command or an alarm reconciliation, the coordinator
publishes:

```ts
{ type: 'session/changed', session }
```

The platform type intentionally declares `session: unknown`: runtime delivery
cannot establish a Domain type. `ChromeSessionClient.subscribe()`:

1. ignores non-record messages;
2. ignores any record whose `type` is not `session/changed`;
3. validates `event.session` through `parseSessionProjection`;
4. ignores an invalid projection rather than corrupting the current UI store;
5. calls the subscriber only with a reconstructed `Session` or `null`.

`parseSessionProjection()` rebuilds the nested Workflow through
`createWorkflow()` and the Session through `restoreSession()`. This reapplies
Domain invariants, including Phase structure, Reward Dice defaults and valid
Session state fields.

Unlike command/request parsers, the current event listener filters the `type`
and validates the payload but does not enforce an exact top-level key set for
`session/changed`. Treat the declared `{ type, session }` shape as the producer
contract; changing strictness requires compatible producer and consumer tests.

## Workflow Catalog Event Boundary

`workflow/catalog-changed` deliberately carries no catalog data:

```ts
{ type: 'workflow/catalog-changed' }
```

Its parser requires that exact single key. Unrelated or malformed messages are
ignored by this subscriber. After a successful parse, the catalog hook queues a
fresh repository read.

Publishers use `runWorkflowCatalogMutation()`, which awaits the mutation before
publishing. A rejected mutation emits no event. If mutation succeeds but runtime
publication fails, the mutation remains committed and the caller receives the
publication failure; another context may then remain stale until its next reload
or invalidation.

## Listener Coexistence

Chrome invokes several `runtime.onMessage` listeners for the same raw value.
Flowarium listeners therefore use ownership filtering:

- Session command listener attempts only supported Session commands;
- active Session listener attempts only `session/get-active`;
- Workflow subscriber attempts only `workflow/catalog-changed`;
- Session projection subscribers check only `session/changed`.

A validation failure caused by a message belonging to another contract returns
without a response or state change. Unexpected errors outside the defined
validation error are rethrown at the adapter boundary.

## Adding or Changing a Message

Any contract change must update together:

1. the declaration in `RuntimeMessage.ts`;
2. an exact runtime parser for command/request/invalidation input;
3. the Platform bus or event adapter;
4. the `app` client/coordinator handler;
5. response and projection validation;
6. producer and consumer tests;
7. this catalog and any affected flow document.

Do not send Domain objects on trust, use `any`, deep-import a feature, or allow a
Presentation component to call `browser.runtime` directly.

## Verification Sources

- [`runtimeMessageSchema.test.ts`](../../src/platform/messaging/runtimeMessageSchema.test.ts)
  proves exact input validation.
- [`ChromeSessionClient.test.ts`](../../src/app/session/ChromeSessionClient.test.ts)
  proves outgoing payloads, response normalization and projection filtering.
- [`createSessionCoordinator.test.ts`](../../src/app/background/createSessionCoordinator.test.ts)
  proves routing, idempotency, persistence/alarm coordination and broadcasts.
- [`ChromeWorkflowCatalogEvents.test.ts`](../../src/platform/messaging/ChromeWorkflowCatalogEvents.test.ts)
  proves invalidation publication and filtering.
- [State and Data Flow](STATE_AND_DATA_FLOW.md) explains the state updated by
  these messages.
