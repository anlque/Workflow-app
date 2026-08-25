# Add a Persisted Workflow Field

## Use When

Use this recipe when an accepted product rule adds or changes data owned by the
Workflow aggregate, one of its Phases, an Environment or Reward Dice, and the
value must survive save/load. For a concrete completed example, follow the
[rerolls walkthrough](../../onboarding/04_FIRST_CHANGE.md).

Do not use it to put Session execution state, UI-only draft state or Asset Blob
content into Workflow.

## Before Editing

1. Name the rule in the
   [Product Specification](../../concepts/01_PRODUCT_SPECIFICATION.md) and
   [Domain Model](../../concepts/02_DOMAIN_MODEL.md). Resolve ownership before
   choosing files.
2. Decide whether active Sessions freeze the value in their immutable snapshot.
   The default for Workflow execution configuration is yes.
3. List every current constructor/copy with `rg "createWorkflow\\(" src` and
   every serialized occurrence of the containing Value Object.
4. Read the [Workflow](../features/WORKFLOW.md),
   [Session](../features/SESSION.md) and
   [Persistence](../PERSISTENCE.md) references.
5. Decide compatibility explicitly: safe missing-value default, record/package
   version, Dexie migration or rejection.
6. Create an ADR only if ownership, dependency direction, technology or the
   compatibility strategy changes. Routine aggregate evolution does not need an
   ADR.

## Likely Owners

| Concern                           | Likely owner                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| Trusted/input shape and invariant | `src/features/workflow/domain/`                                  |
| Create/update/duplicate behavior  | `src/features/workflow/application/`                             |
| Public Workflow package           | `workflowPackageMapping.ts`, export/import use cases             |
| Stored Workflow record            | `WorkflowRecord.ts`, `mapWorkflowRecord.ts`                      |
| Active execution copy             | `src/features/session/domain/SessionSnapshot.ts`                 |
| Stored/message-restored snapshot  | Session Infrastructure and `parseSessionProjection.ts`           |
| Editable draft/control            | Workflow Presentation                                            |
| Concrete composition              | `src/app/options/` only when policy or dependency wiring changes |

Cross a feature boundary only through its root `index.ts`; see
[Architecture Boundaries](../ARCHITECTURE_BOUNDARIES.md) and
[ADR-0002](../../adr/ADR-0002-feature-first-clean-architecture.md).

## Ordered Steps

1. Add a failing Domain test for accepted, rejected and missing/legacy input.
2. Update the Workflow-owned input and trusted types. Keep raw input optional
   only when absence has a defined compatibility meaning.
3. Update `createWorkflow()` so every trusted Workflow contains the normalized
   field and invalid values cannot escape.
4. Update create/update inputs and every explicit copy, especially duplicate and
   import reconstruction. Rebuild through the constructor; do not spread a raw
   record into Domain.
5. Update `WorkflowRecord`, its `unknown` mapper and serializer. Current writes
   should emit the canonical value even when old reads accept omission.
6. Decide whether the Dexie table/index definition changed. If yes, stop this
   recipe and also follow [Change a Database Schema](CHANGE_DATABASE_SCHEMA.md).
7. Update Workflow package serialization and parsing. Preserve exact-key
   validation, embedded Asset rules and identity/reference rewriting.
8. Copy the field into `createSessionSnapshot()` when it affects execution.
   Update Session record restoration and runtime projection parsing for the
   nested Workflow.
9. Update editor draft type, initialization, field-level validation and numeric
   or semantic conversion to `CreateWorkflowInput`.
10. Add an accessible control in the owning editor component and connect it in
    `WorkflowEditor` without moving the invariant into React.
11. Update the runtime consumer that uses the field. Keep per-interaction UI
    state separate from reusable Workflow configuration.
12. Export a new type/function from `src/features/workflow/index.ts` only when an
    external consumer intentionally needs it.

## Compatibility Checks

- **Old records:** does an absent field have one safe meaning? If not, use a
  record version/migration rather than an arbitrary default.
- **Current writes:** do they always store the canonical field?
- **Workflow packages:** can version 1 readers/writers stay compatible, or must
  the public envelope version change under
  [ADR-0007](../../adr/ADR-0007-versioned-import-export.md)?
- **Session history:** can stored snapshots without the field still restore?
- **Active Sessions:** do source Workflow edits remain isolated by
  [ADR-0003](../../adr/ADR-0003-workflow-aggregate-session-snapshot.md)?
- **Copy boundaries:** do duplicate, import, package, snapshot and projection
  preserve the value?
- **Asset references:** if the field introduces one, validate identity, expected
  kind, deletion references and package inclusion.
- **Unknown keys:** do record/package/message parsers still reject unsupported
  shapes where their contract is exact?

## Tests

Add the lowest-level proof first:

```bash
pnpm vitest run src/features/workflow/domain
pnpm vitest run src/features/workflow src/features/session
```

Expected coverage:

- Domain default/bounds/invariant;
- duplicate or other explicit copy;
- Workflow record old-read/new-write behavior;
- Workflow package round-trip and invalid input with zero writes;
- Session snapshot independence and legacy restoration;
- editor draft/control/save behavior;
- runtime consumer behavior.

Update Playwright only when the assembled user journey materially changes. Do
not add E2E merely to repeat a Domain boundary already proven cheaply.

## Documentation Impact

Update, as applicable:

- Product Specification and Domain Model for the rule;
- [Workflow](../features/WORKFLOW.md) and [Session](../features/SESSION.md);
- [Persistence](../PERSISTENCE.md) for record/default/package behavior;
- the affected [flow](../flows/START_SESSION.md) or
  [Reward Dice flow](../flows/REWARD_DICE.md);
- this recipe/walkthrough if the change surface itself evolves;
- ADR index only when a new architectural decision is accepted.

## Stop and Reconsider If

- the value describes one Session occurrence rather than reusable Workflow
  configuration;
- a mapper default would silently reinterpret existing user data;
- the same business rule is being implemented independently in Domain and UI;
- a change requires importing another feature's internal file;
- an active Session would begin reading the mutable source Workflow;
- public package compatibility is being assumed without a round-trip test;
- deleting the database is proposed instead of a forward migration;
- generated `.output/` files appear in the edit list.
