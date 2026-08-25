# Add or Select a Test

## Use When

Use this recipe for a new requirement, regression or compatibility guarantee
when deciding the cheapest test that can reliably prove it. Read the normative
[Testing Strategy](../../concepts/08_TESTING_STRATEGY.md) and current
[Testing and Debugging](../TESTING_AND_DEBUGGING.md) configuration first.

Tests are evidence for behavior, not a coverage quota.

## Before Editing

1. Write one sentence describing the observable contract or regression.
2. Name the owner: Domain, Application, Infrastructure, Presentation,
   architecture or assembled extension journey.
3. Identify the lowest boundary where failure is visible without testing private
   implementation.
4. List nondeterministic inputs—clock, timers, randomness, storage, runtime
   messages and browser shell—and choose explicit controls.
5. Check nearby tests to reuse vocabulary and fixture shape without creating a
   hidden shared-state dependency.
6. For a bug, reproduce it with a failing test before changing production code.
7. Keep the test at its architectural owner under
   [ADR-0002](../../adr/ADR-0002-feature-first-clean-architecture.md); tests may
   access owner internals only when colocated inside that feature.

## Likely Owners

| Test kind               | File/environment                                                 | Best for                                             | Typical boundary                                 |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Domain unit             | colocated `.test.ts`, Node                                       | invariant, pure transition, probability              | injected plain values/clock/randomness           |
| Application integration | colocated `.test.ts`, Node                                       | use case plus ports                                  | in-memory repository/fake clock                  |
| Repository integration  | Infrastructure `.test.ts`, Node + explicit `fake-indexeddb/auto` | record mapping, ordering, transaction, compatibility | real Dexie over isolated fake database           |
| Component/hook          | colocated `.test.tsx`, jsdom                                     | accessible interaction, draft, pending/error state   | injected props/services and Testing Library      |
| Architecture            | `tests/architecture/*.test.ts`, Node                             | import direction/public API                          | source-tree scan plus ESLint                     |
| End-to-end              | `tests/e2e/*.spec.ts`, built Chromium extension                  | critical cross-context journey                       | real worker/storage/messages in isolated profile |

Filename matches the primary source symbol. E2E filenames name the user journey.

## Ordered Steps

1. Choose the row above that can prove the requirement with the least runtime and
   fewest unrelated failure causes.
2. Place the test beside its source owner, except repository-wide architecture
   and Playwright journeys.
3. Build the smallest explicit fixture. Do not depend on data left by another
   test or execution order.
4. Inject time and randomness. Use `FakeClock`, fake timers and deterministic
   random sequences rather than real delays or `Math.random()` in assertions.
5. For Application tests, use ports/fakes and the real Domain. Mock only the
   unstable boundary whose interaction is part of the contract.
6. For repository tests, import `fake-indexeddb/auto`, generate a unique database
   name, test `unknown`/legacy/corrupt records and delete only that isolated test
   database during cleanup.
7. For React, query by role, accessible name, label and visible status/error.
   Drive realistic interactions; use `data-testid` only when semantics cannot
   identify a visual-only element.
8. For runtime messages, test exact parser rejection and producer/consumer sides.
   Do not prove only a TypeScript declaration.
9. For a regression, verify red → green: the test fails for the original defect,
   passes with the correction and would fail again if the correction were
   removed.
10. Add Playwright only when real extension origin, service worker, storage,
    alarms or cross-document collaboration is essential. Reuse
    `extensionFixture.ts`; avoid arbitrary sleep.
11. Run the single test, then its owner directory, then the complete required
    gate before handoff.

## Compatibility Checks

- **Behavior:** does the assertion protect a public rule, failure or regression
  rather than a private function/call order?
- **Determinism:** are clock, randomness, timers, IDs and storage isolated?
- **Failure clarity:** will one broken responsibility produce a specific test
  name and useful diff?
- **Duplication:** is a higher-level test adding confidence not already provided
  cheaply below?
- **Boundary realism:** are real collaborating modules used where practical?
- **Persistence:** do tests cover old reads, new writes and no partial writes?
- **Accessibility:** do component/E2E queries match user and assistive-technology
  access?
- **E2E fixture limit:** is direct-page Playwright not being used to claim native
  toolbar/side-panel shell behavior?
- **Architecture:** does test code respect public APIs unless it is colocated
  inside the owning feature?

## Tests

Focused command forms:

```bash
pnpm vitest run path/to/Owner.test.ts
pnpm vitest run src/features/<feature>
pnpm exec playwright test tests/e2e/<journey>.spec.ts
```

Repository completion gate:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` rebuilds before Playwright. CI instead runs build once and then
`pnpm exec playwright test`.

## Documentation Impact

- Update the owning feature/flow `Tests` or `Proof in Tests` section when the
  canonical proof changes.
- Update [Testing and Debugging](../TESTING_AND_DEBUGGING.md) when commands,
  environments, fixture behavior or troubleshooting changes.
- Update the Testing Strategy only when normative policy changes.
- An architectural test change may require the
  [Architecture Boundaries](../ARCHITECTURE_BOUNDARIES.md) reference and a new
  ADR if dependency direction changes.
- Do not copy complete test policy into feature pages; link to its owner.

## Stop and Reconsider If

- an E2E test is the first attempt to prove a pure Domain rule;
- the test needs a real clock, uncontrolled random value or arbitrary delay;
- a component assertion reads internal React state or relies on CSS classes when
  semantic behavior is available;
- a repository fixture reuses the developer's `flowarium` database;
- test cleanup could delete a non-test database or broad filesystem path;
- production code gains a test-only branch;
- a mock replaces the behavior being tested;
- the test passes before the reported regression is reproduced.
