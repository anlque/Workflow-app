# State and Data Flow

Locusora separates state by owner and lifetime. The central rule is that a
stored value, an authoritative runtime value and a React projection are not the
same kind of state even when they describe the same Session or Workflow.

## State Ownership Matrix

| State | Authoritative owner | Representation | Lifetime | Consumers | Synchronization |
| --- | --- | --- | --- | --- | --- |
| Workflow aggregate | Workflow Domain | Immutable `Workflow` with ordered Phases, Environments and optional Reward Dice | Until replaced or deleted | Workflow use cases, editors and Session snapshot creation | Repository reads; catalog invalidation tells open surfaces to reload |
| Session aggregate | Session Domain; execution coordinated by background Application composition | Immutable discriminated `Session` union | Start through Completed or Stopped history | Background coordinator and surface projections | Session commands, persistence and `session/changed` |
| Workflow records | Workflow Infrastructure | Validated `WorkflowRecord` rows | Durable IndexedDB data | `DexieWorkflowRepository` | IndexedDB transactions and explicit catalog reload |
| Session records | Session Infrastructure | Validated `SessionRecord` rows | Durable IndexedDB data | `DexieSessionRepository` and background reconciliation | Save per authoritative transition; load on worker startup/wake |
| Asset metadata and blobs | Assets Infrastructure | Asset record plus Blob | Durable IndexedDB data | Options, focus Environment and package import/export | Repository reads/writes; Workflow stores only Asset identifiers |
| Application Settings | Settings Infrastructure | One validated Settings value under `settings` | Durable `chrome.storage.local` data | Options, focus and side-panel composition | Explicit repository read/update; not Zustand or IndexedDB |
| Active Session execution | Background worker composition | Current persisted Session plus alarm and in-memory command coordination | Across surface closure; reconstructed after worker restart | Focus view and side panel via messages | Background commands, epoch reconciliation, save, alarm scheduling, broadcast |
| Active Session projection | Session Presentation in each open focus/side-panel document | One `ActiveSessionStore` containing `session`, connection and error | Current document only | React components in that document | Initial `session/get-active` plus `session/changed` replacement |
| Workflow catalog projection | Workflow Presentation in each open catalog surface | `workflows`, `refreshError`, queued/in-flight reload markers | Current hook instance | Focus launcher and side-panel Workflow Library | `workflow/catalog-changed` triggers repository reload |
| Form, tab, dialog and feedback state | Owning React component or hook | `useState`, refs and editor drafts | Current component tree | Owning UI only | Direct callbacks; persisted only when an Application operation succeeds |
| Countdown text | Session Presentation | Value computed by `formatSessionCountdown(session, now)` | One render/tick | Active Session and compact views | Recomputed from Session anchors and current time; never persisted as a counter |
| Asset object URL | `BrowserAssetUrlService` consumer | Temporary `blob:` URL | Until the consumer releases it or the document unloads | Asset preview and focus Environment media | Created from a loaded Blob, then explicitly revoked |
| Side-panel visibility label | Focus `app` composition and React state | Boolean projection of browser lifecycle | Current focus document | Focus open/close button | Optimistic action plus `sidePanel.onOpened`/`onClosed` events |

Normative ownership is defined by
[Architecture](../concepts/03_ARCHITECTURE.md#state-management) and
[ADR-0004](../adr/ADR-0004-authoritative-session-execution.md). This table
describes the current realization.

## Immutable Domain Values

Workflow constructors copy and freeze aggregate values. Session transitions
return new frozen variants rather than mutating the previous Session. Starting a
Session copies the Workflow into `SessionSnapshot`, including Reward Dice and
its sides.

Consequences:

- editing or deleting the source Workflow does not alter an active Session;
- Presentation can replace a whole projection instead of coordinating partial
  mutations;
- Infrastructure maps records into trusted Domain values before returning them;
- derived state must not be written back into the aggregate merely for UI
  convenience.

## Authoritative Session Flow

The active Session has one command path:

```text
focus view or side panel
        |
        | session command
        v
ChromeSessionClient
        |
        | runtime message carrying commandId
        v
background ChromeMessageBus
        |
        | parsed SessionCommand
        v
createSessionCoordinator
        |
        +--> Session Application use case
        |        |
        |        +--> Domain transition
        |        +--> SessionRepository.save
        |
        +--> alarm schedule or clear
        +--> session/changed broadcast
                         |
                         v
            per-document Zustand projection
                         |
                         v
                       React
```

The background coordinator is authoritative because it serializes the command
path and owns alarm reconciliation. IndexedDB is durable storage for the
aggregate, but records do not execute behavior. React and Zustand display
projections, but they do not decide or persist authoritative transitions.

## Startup and Projection Race Handling

`connectSessionMessages()` performs startup in this order:

1. subscribe to `session/changed`;
2. request `session/get-active`;
3. replace the store with the response only if no event arrived first;
4. mark the connection as connected, or store the request error.

Subscribing first prevents a change between the request and listener
registration from being lost. The `receivedEvent` flag prevents a slower initial
response from overwriting a newer broadcast. `disconnect()` marks the connection
inactive before removing the listener, so late Promise resolution cannot update
an unmounted surface.

## Time and Derived Countdowns

Running Sessions persist `phaseStartedAt` and `phaseEndsAt`; Transitioning
Sessions persist `transitionEndsAt`; Paused Sessions persist `pausedAt` and
`remainingMilliseconds`. The visible countdown is derived:

```text
running: ceil((phaseEndsAt - now) / 1000), minimum 0
paused:  ceil(remainingMilliseconds / 1000)
other:   0
```

Chrome alarms only wake the background coordinator. On initialization, request
or alarm handling, Application derives the state that should exist at the
current epoch. A late alarm may therefore advance through elapsed boundaries.
No interval and no stored decrementing counter is a time authority.

## Workflow Catalog Invalidation

`runWorkflowCatalogMutation()` publishes `workflow/catalog-changed` only after
its mutation resolves. The event contains only its `type`; it carries no
Workflow payload, version or identifier.

`useWorkflowCatalog()`:

1. subscribes to invalidation before its first load;
2. queues a reload for each observed invalidation;
3. coalesces invalidations while one load is in flight;
4. repeats the load if another invalidation was queued;
5. replaces the catalog and clears `refreshError` on success;
6. keeps the last successful catalog and stores `refreshError` on failure;
7. ignores completions after unmount.

This design makes IndexedDB the catalog source of truth. The event is a prompt
to read it again, not another copy of catalog state. It also means Workflow
changes do not modify the immutable snapshot of an active Session.

## Presentation State

Local React state owns values that do not need cross-context durability:

- Options `workflows | assets | settings` tab;
- side-panel `session | workflows` view;
- selected Workflow and unsaved editor draft;
- open dialogs, roll animation progress and displayed Reward;
- pending, success and error feedback;
- focus volume, audio lock and side-panel button state.

Reloading or closing the document may discard these values. If losing a value
would violate a business invariant or destroy accepted user data, it does not
belong only in React state.

## Asset URL Lifecycle

Asset Blobs are durable; object URLs are not. Presentation asks the repository
for a Blob, asks `BrowserAssetUrlService` to create a URL, and releases that URL
when the Asset changes or the component unmounts. A URL must not be persisted or
sent to another extension context because its lifecycle belongs to the creating
document.

## Synchronization Rules

- Extension contexts never share JavaScript memory.
- Each focus/side-panel Zustand store is a disposable projection.
- Session commands go to the background; surfaces do not save Session records.
- Workflow and Asset CRUD go through their Application/repository boundaries.
- Settings use `chrome.storage.local`; they are not copied into IndexedDB.
- Countdown values derive from epoch anchors.
- Catalog invalidation contains no Workflow data and does not poll.
- Active Sessions remain bound to the Workflow snapshot captured at start.
- Runtime input, persistence records and imported files remain `unknown` until
  their owning boundary validates them.

## Source Owners

- [`createSessionCoordinator.ts`](../../src/app/background/createSessionCoordinator.ts)
  owns authoritative background coordination.
- [`ChromeSessionClient.ts`](../../src/app/session/ChromeSessionClient.ts) owns
  the surface command/projection client.
- [`ActiveSessionStore.ts`](../../src/features/session/presentation/ActiveSessionStore.ts)
  owns the per-document Session projection shape.
- [`connectSessionMessages.ts`](../../src/features/session/presentation/connectSessionMessages.ts)
  owns startup synchronization.
- [`useWorkflowCatalog.ts`](../../src/features/workflow/presentation/useWorkflowCatalog.ts)
  owns catalog reload coordination.
- [`runWorkflowCatalogMutation.ts`](../../src/app/runWorkflowCatalogMutation.ts)
  owns success-only catalog invalidation composition.
- [Messaging](MESSAGING.md) catalogs the runtime contracts.
- [Persistence](PERSISTENCE.md) documents the durable representations.
