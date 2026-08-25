# First Change Walkthrough: Reward Dice Rerolls

This walkthrough reconstructs an already implemented change: configurable Reward
Dice rerolls. It is a source-reading exercise, not an instruction to add the
field again or edit its value. Its purpose is to show how one product rule crosses
Domain, copy boundaries, persistence, public packages, Session snapshots,
Presentation and tests.

Before following it, read the [System Tour](02_SYSTEM_TOUR.md),
[Runtime Model](03_RUNTIME_MODEL.md), [Workflow reference](../development/features/WORKFLOW.md)
and [Persistence reference](../development/PERSISTENCE.md).

## Start From the Product Rule

The normative rule lives in the
[Product Specification](../concepts/01_PRODUCT_SPECIFICATION.md) and
[Domain Model](../concepts/02_DOMAIN_MODEL.md):

- each Reward permits 0–3 rerolls after the initial roll;
- missing legacy values default to 0;
- the allowance starts fresh for each Reward;
- unused rerolls do not carry over;
- Continue accepts the last displayed result.

This was not an ADR-level change. It extended an existing Workflow-owned value
inside the accepted aggregate, snapshot and persistence architecture; it did not
choose a new technology, dependency direction or long-lived integration. A
different ownership decision—for example, durable Reward occurrence and
acknowledgment—would require an architectural review.

## Impact Map

```text
Concept rule
    ↓
RewardDiceInput → createWorkflow() → trusted RewardDice
    ↓                    ↓
editor draft       duplicate/copy boundaries
    ↓                    ↓
Workflow record ← Workflow package → Session snapshot
    ↓                                      ↓
IndexedDB                         runtime projection parser
                                           ↓
                                  RewardResultDialog
                                           ↓
                                  assembled E2E journey
```

The field must survive every arrow. Adding it only to the editor would create a
setting that disappears; adding it only to Domain would create a rule users
cannot configure; omitting a copy boundary would silently reset it.

## 1. Model and Validate the Rule

| Source                                                                      | What changed                                                                                                            | Why this owner                                         | If omitted                                                                     | Proof                                                                                                                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`RewardDice.ts`](../../src/features/workflow/domain/RewardDice.ts)         | Trusted `RewardDice.rerolls` is required; `RewardDiceInput.rerolls` is optional for legacy callers                      | Workflow owns Reward Dice value semantics              | Consumers could not distinguish trusted values from backward-compatible input  | `domain/createWorkflow.test.ts` compiles and exercises both shapes                                                                            |
| [`createWorkflow.ts`](../../src/features/workflow/domain/createWorkflow.ts) | Missing input becomes `0`; only integer values 0–3 are accepted; the frozen result always contains the normalized value | All Workflow construction crosses this Domain boundary | Invalid values could enter storage/snapshots, or old values would stop loading | [`createWorkflow.test.ts`](../../src/features/workflow/domain/createWorkflow.test.ts) checks default, every accepted value and invalid bounds |

The constructor is the final authority. Presentation validation improves feedback,
but it cannot replace Domain validation because storage, import, duplication and
Session restoration do not originate in the editor.

## 2. Preserve Every Workflow Copy

Workflow values are immutable. Operations that produce an independent Workflow
rebuild it through `createWorkflow()` and must copy every owned field explicitly.

| Source                                                                                               | What changed                                                                                                          | Why this owner                                                    | If omitted                                                                  | Proof                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`duplicateWorkflowUseCase.ts`](../../src/features/workflow/application/duplicateWorkflowUseCase.ts) | Copies `source.rewardDice.rerolls` into the new constructor input                                                     | Duplication owns creation of an independent aggregate             | A duplicate would silently fall back to 0                                   | [`workflowUseCases.test.ts`](../../src/features/workflow/application/workflowUseCases.test.ts) duplicates a value of 3 |
| [`workflowPackageMapping.ts`](../../src/features/workflow/application/workflowPackageMapping.ts)     | Serializes current rerolls, accepts the optional key, narrows it as a number and delegates final validation to Domain | Mapping owns the public Workflow transport shape                  | Export would lose the value, or older packages without it would be rejected | [`workflowPackage.test.ts`](../../src/features/workflow/application/workflowPackage.test.ts) round-trips a value of 3  |
| [`importWorkflowUseCase.ts`](../../src/features/workflow/application/importWorkflowUseCase.ts)       | Copies parsed rerolls while rebuilding the imported Workflow with new identities                                      | Import owns identity/reference rewriting after package validation | The parsed value would be discarded during the second constructor pass      | The same package round-trip test and `tests/e2e/dataPortability.spec.ts`                                               |

The public package remains `flowarium/workflow` version 1 because the reader
accepts the absent field and Domain supplies the documented legacy default.
Current writers include it. An incompatible semantic or structural change would
require a new package version rather than another implicit default.

## 3. Store and Restore the Workflow

| Source                                                                                    | What changed                                                                                            | Why this owner                                                | If omitted                                      | Proof                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`WorkflowRecord.ts`](../../src/features/workflow/infrastructure/WorkflowRecord.ts)       | Adds optional `rewardDice.rerolls` to the version-1 record type                                         | Infrastructure owns persisted representation and legacy shape | Mapper and stored representation would disagree | Repository compilation and tests                                                                                                                                |
| [`mapWorkflowRecord.ts`](../../src/features/workflow/infrastructure/mapWorkflowRecord.ts) | Reads optional rerolls as `unknown`, passes it to Domain and writes the trusted value on every new save | Mapper is the trust boundary between IndexedDB and Domain     | Reload would reset or trust invalid stored data | [`DexieWorkflowRepository.test.ts`](../../src/features/workflow/infrastructure/DexieWorkflowRepository.test.ts) restores 3 and maps an absent legacy value to 0 |

No Dexie database version changed: `rerolls` is not an index and does not alter
the `workflows: 'id, order'` table definition. No record version changed because
the version-1 reader remains backward-compatible. If stored records required a
data transformation rather than a constructor default, follow the
[database schema recipe](../development/recipes/CHANGE_DATABASE_SCHEMA.md); do
not infer that every field is migration-free.

## 4. Freeze the Value Into a Session

Starting a Session creates an immutable Workflow copy. It must preserve rerolls
even if the reusable source Workflow is later edited or deleted.

| Source                                                                                           | What changed                                                                                        | Why this owner                                                       | If omitted                                                                | Proof                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`SessionSnapshot.ts`](../../src/features/session/domain/SessionSnapshot.ts)                     | Copies rerolls while rebuilding the Workflow snapshot                                               | Session Domain owns independence from the reusable source            | Running Session behavior would reset to 0                                 | [`Session.test.ts`](../../src/features/session/domain/Session.test.ts) asserts an independent frozen snapshot with value 3 |
| [`mapSessionRecord.ts`](../../src/features/session/infrastructure/mapSessionRecord.ts)           | Accepts optional rerolls inside the stored nested Workflow and reconstructs through Workflow Domain | Session Infrastructure owns durable snapshot restoration             | A worker restart/alarm read would lose or reject the configured allowance | Repository suite plus the assembled Reward E2E alarm path                                                                  |
| [`parseSessionProjection.ts`](../../src/features/session/presentation/parseSessionProjection.ts) | Validates optional rerolls in the transport-safe nested Workflow before Presentation receives it    | Chrome messages contain runtime data, not trusted TypeScript objects | Focus could render a stale default or accept malformed projection data    | `parseSessionProjection.test.ts`; the E2E reroll button proves the assembled message path                                  |

The runtime message envelope did not change: `session/changed.session` is
intentionally `unknown`. Its nested Session parser changed because that is where
the complete projection crosses into trusted Presentation state.

## 5. Make the Rule Editable

The editor keeps strings because form controls can temporarily contain incomplete
or invalid text. Conversion to Domain input happens only on validation.

| Source                                                                                  | What changed                                                                                                                 | Why this owner                                                       | If omitted                                                             | Proof                                                                                                                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`useWorkflowEditor.ts`](../../src/features/workflow/presentation/useWorkflowEditor.ts) | Adds string draft state, defaults existing/missing values, parses integer 0–3, reports a field error and emits numeric input | The hook owns editor state and draft-to-input mapping                | The control would not round-trip existing data or block invalid drafts | [`WorkflowEditor.test.tsx`](../../src/features/workflow/presentation/WorkflowEditor.test.tsx) checks default, invalid 4 and saved 3 |
| [`RewardDiceEditor.tsx`](../../src/features/workflow/presentation/RewardDiceEditor.tsx) | Renders the labelled 0–3 select and delegates changes                                                                        | This component owns Reward Dice form controls, not Domain validation | Users could not configure the supported field accessibly               | [`RewardDiceEditor.test.tsx`](../../src/features/workflow/presentation/RewardDiceEditor.test.tsx) checks label, error and selection |
| [`WorkflowEditor.tsx`](../../src/features/workflow/presentation/WorkflowEditor.tsx)     | Connects the Reward editor callback to the editor hook                                                                       | The aggregate editor composes its owned sub-form                     | UI selection would never update the submitted draft                    | `WorkflowEditor.test.tsx` verifies `onSave` receives 3                                                                              |

The UI uses a select because the valid set is small and closed. Presentation's
error is specific, while Domain remains authoritative for non-UI callers.

## 6. Enforce the Allowance During a Reward

[`RewardResultDialog.tsx`](../../src/features/session/presentation/RewardResultDialog.tsx)
owns the interaction-only state:

1. `usedRerolls` begins at 0.
2. The initial **Roll dice** does not increment it.
3. **Roll again** is offered only when `dice.rerolls - usedRerolls > 0`.
4. Each reroll replaces the local result and increments the used count.
5. Continue accepts the last visible result.

This belongs to Session Presentation because the current product does not persist
Reward outcomes or statistics. Putting `usedRerolls` into Workflow would mix one
execution's UI state into reusable configuration.

[`RewardResultDialog.test.tsx`](../../src/features/session/presentation/RewardResultDialog.test.tsx)
injects deterministic random values and fake timers. It proves two additional
rolls replace results, update the label and then remove the action.

### Current Limitation

The normative allowance resets for each new Reward, but `usedRerolls` currently
exists only in mounted React state. Reopening the focus document during the same
non-final pending Reward remounts the dialog and resets the counter. This is
documented in the [Reward Dice flow](../development/flows/REWARD_DICE.md); do not
copy that limitation into new code as intended behavior. Fixing it requires a
decision about durable Reward occurrence/acknowledgment, not a hidden browser
cache in the component.

## 7. Prove the Assembled Journey

[`workflowExecution.spec.ts`](../../tests/e2e/workflowExecution.spec.ts)
configures one reroll in Options, saves and starts the Workflow, advances the
real background Session through IndexedDB/alarm boundaries, rolls once, rerolls
once and verifies no further reroll action remains before Continue.

That one journey proves collaboration among:

- Options editor and Workflow persistence;
- Session snapshot creation and durable restoration;
- background alarm reconciliation and `session/changed` messaging;
- focus projection parsing and Reward dialog behavior.

It does not replace the lower-level tests: if the E2E fails, those tests identify
whether the rule, mapper, editor or dialog owns the regression.

## What Did Not Change

- No new feature or cross-feature dependency was introduced.
- No database table/index or global Dexie version changed.
- No runtime message type or Chrome permission changed.
- No new package version was required because missing values remain supported.
- Generated `.output/` files were never edited; WXT recreates them from source.

## Reusable Impact-Analysis Checklist

Before adding or changing a persisted Workflow field:

1. **Concepts:** locate the Product and Domain rule; add one if semantics are not
   yet accepted.
2. **ADR:** decide whether this is routine implementation or a long-lived change
   to ownership, technology, boundaries or compatibility strategy.
3. **Domain:** update input/trusted types, constructor defaults, validation,
   immutability and focused tests.
4. **Copy boundaries:** search every constructor call and explicit copy,
   especially duplicate/import and nested Value Objects.
5. **Session snapshot:** decide whether active Sessions freeze the new value;
   update snapshot creation and restoration if they do.
6. **Storage compatibility:** update the owning record/mapper and choose an
   explicit legacy default, record version or Dexie migration.
7. **Import/export compatibility:** update serialization/parser and decide
   whether the public envelope version can remain compatible.
8. **Presentation:** update draft type/defaults, conversion, accessible control,
   error feedback and runtime consumer.
9. **Messaging:** check whether an envelope changes or only a nested runtime
   parser; validate both sides of every affected boundary.
10. **Tests:** add the cheapest focused Domain, Application, repository and
    component proofs. Add/update E2E only when assembled behavior materially
    changes.
11. **Documentation:** update the feature, persistence, flow, recipe and
    onboarding pages that describe the changed contract.
12. **Verification:** run focused tests first, then the complete repository gate.

Never solve a missing step by weakening TypeScript, deep-importing another
feature, casting persisted data or editing generated output.
