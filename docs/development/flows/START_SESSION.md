# Start Session Flow

## Trigger

A user starts an existing Workflow from either:

- the idle focus launcher in
  [`FocusApp.tsx`](../../../src/app/focus/FocusApp.tsx); or
- the Workflow Library in
  [`SidePanelApp.tsx`](../../../src/app/side-panel/SidePanelApp.tsx), after
  which the side panel activates the focus tab.

The extension toolbar action only opens or activates the focus tab. It does not
implicitly select or start a Workflow.

## Preconditions

- The selected Workflow exists in IndexedDB and crosses its record/Domain
  validation boundary successfully.
- No Running, Transitioning or Paused Session exists.
- The background worker has initialized its message handlers, repository and
  alarm listener.
- The sending surface can reach the background through Chrome runtime messaging.

## Sequence

1. Focus or side-panel Presentation passes a `WorkflowId` to its injected
   `start`/`startSession` dependency. The focus launcher also attempts to unlock
   UI audio from this user gesture.
2. [`ChromeSessionClient.start()`](../../../src/app/session/ChromeSessionClient.ts)
   creates a unique `commandId` and sends an exact `session/start` command with
   the Workflow identifier.
3. [`ChromeMessageBus`](../../../src/platform/messaging/ChromeMessageBus.ts)
   accepts the message only after `parseSessionCommand()` verifies its exact
   keys and non-empty strings. Unrelated listeners ignore it.
4. [`createSessionCoordinator`](../../../src/app/background/createSessionCoordinator.ts)
   deduplicates the command by `commandId`, converts the Workflow string through
   `createWorkflowId()` and loads the Workflow repository.
5. The coordinator rejects a missing Workflow before calling Session
   Application behavior.
6. [`startSessionUseCase`](../../../src/features/session/application/startSessionUseCase.ts)
   checks `SessionRepository.getActive()`. An existing active Session rejects
   the operation.
7. [`createSession()`](../../../src/features/session/domain/Session.ts) creates a
   Running Session. `createSessionSnapshot()` deep-copies the complete Workflow
   through its Domain constructor; edits to the source cannot affect execution.
8. The use case saves the Session. `DexieSessionRepository` repeats the
   one-active check in its write transaction, protecting against competing
   starts.
9. The coordinator publishes `session/changed` with the saved Session and then
   schedules `flowarium.session-phase` for `phaseEndsAt`.
10. The message bus returns `{ ok: true, result: session }` to the command
    sender. `ChromeSessionClient` runtime-validates the result even though its
    public start method returns `void`.
11. Each connected focus/side-panel document receives the event through
    `connectSessionMessages()` and replaces its local Zustand projection. The
    focus surface renders the first Environment and countdown. A side-panel
    start then opens or activates the focus tab.

## Authoritative Changes

- A new version-1 Session record becomes the only active record.
- Its immutable snapshot, current Phase index 0 and wall-clock start/end anchors
  become authoritative.
- Each document's React/Zustand state is only a replaceable projection of that
  persisted Session.
- Source Workflow and Settings are unchanged.

## Messages

| Message           | Direction                        | Purpose                                                                      |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `session/start`   | focus/side panel → background    | Request a start by Workflow ID; `commandId` is the in-memory idempotency key |
| `{ ok, result     | error }`                         | background → sender response                                                 | Confirm a validated Session projection or expose a command error |
| `session/changed` | background → extension documents | Replace local active-Session projections after persistence                   |

See the [Runtime Messaging Catalog](../MESSAGING.md) for exact envelopes and
the service-worker lifetime limit of command deduplication.

## Persistence

Workflow is read from `workflows`; the new Session is written to `sessions`.
The Session repository transaction prevents two active identifiers from being
stored concurrently. No Workflow row is changed. The alarm is browser-managed
scheduling state, not the source of elapsed time.

## Failure and Recovery

| Failure                            | Observable result                                                                                           | Recovery                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Invalid message envelope           | No session command listener accepts it                                                                      | Fix the sender/schema pair; validate with messaging tests                                           |
| Missing or corrupt Workflow        | Command returns an error; no Session is written                                                             | Refresh/fix the catalog or persisted record                                                         |
| Active Session already exists      | `An active Session already exists.`; no new record                                                          | Return to or stop the current Session                                                               |
| Session save fails                 | Command rejects; no successful projection is published                                                      | Inspect Session repository/storage failure                                                          |
| Event publication fails after save | Session is already durable; caller sees failure and alarm scheduling is not reached in the current sequence | Reconnect/reload a surface; background initialization reconciles the stored Session and reschedules |
| Sender misses the event            | Its command response still validates, but local UI may lag                                                  | `connectSessionMessages()` hydration requests authoritative active state on mount                   |

## Proof in Tests

- Coordinator lookup, deduplication, publication and alarm behavior:
  `src/app/background/createSessionCoordinator.test.ts`.
- Client command/response validation:
  `src/app/session/ChromeSessionClient.test.ts`.
- one-active Application rule and immutable start:
  `src/features/session/application/sessionUseCases.test.ts`.
- repository concurrency boundary:
  `src/features/session/infrastructure/DexieSessionRepository.test.ts`.
- focus and side-panel triggers:
  `src/app/focus/FocusApp.test.tsx` and `src/app/side-panel/SidePanelApp.test.tsx`.
- assembled extension journey: `tests/e2e/workflowExecution.spec.ts`.

Run focused proof with:

```bash
pnpm vitest run src/app/background src/app/session src/features/session
```

## Related Concepts and ADRs

- [Product Specification](../../concepts/01_PRODUCT_SPECIFICATION.md)
- [Domain Model](../../concepts/02_DOMAIN_MODEL.md)
- [Architecture](../../concepts/03_ARCHITECTURE.md)
- [ADR-0003: Workflow Aggregate and Session Snapshot](../../adr/ADR-0003-workflow-aggregate-session-snapshot.md)
- [ADR-0004: Authoritative Session Execution](../../adr/ADR-0004-authoritative-session-execution.md)
- [State and Data Flow](../STATE_AND_DATA_FLOW.md)
- [Session Feature](../features/SESSION.md)
