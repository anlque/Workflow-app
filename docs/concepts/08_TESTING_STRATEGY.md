# Testing Strategy

---

# Purpose

This document defines how testing is designed, organized and maintained throughout the project.

The Tech Stack document defines which testing tools are used.

This document defines:

- what should be tested;
- at which level it should be tested;
- how tests should be structured;
- which behavior should be mocked;
- how testing supports architectural boundaries;
- how confidence is balanced against maintenance cost.

The purpose of testing is not to maximize the number of tests or achieve an arbitrary coverage percentage.

The purpose is to provide reliable evidence that the application behaves correctly and can evolve without introducing regressions.

---

# Testing Philosophy

Tests should verify meaningful behavior rather than implementation details.

A good test should:

- communicate the requirement it protects;
- fail for a clear reason;
- remain deterministic;
- survive safe refactoring;
- execute at the lowest practical testing level;
- provide confidence proportional to its maintenance cost.

The project follows the principle:

> Use the cheapest test that can reliably prove the required behavior.

Unit tests provide fast and precise feedback.

Integration tests verify collaboration between modules.

End-to-end tests verify that critical user journeys work in the real extension runtime.

No single testing level is sufficient on its own.

---

## Behavior over Implementation

Tests should describe externally observable behavior.

They should avoid depending on:

- private functions;
- internal component state;
- exact hook composition;
- CSS class names;
- internal storage representation;
- implementation-specific call order unless order is part of the contract.

Refactoring internal implementation should not require rewriting tests when public behavior remains unchanged.

For user-interface tests, queries should resemble how users and assistive
technologies locate elements. `data-testid` should be a fallback when semantic
queries are not practical. This follows
[Testing Library's guiding principle](https://testing-library.com/docs/guiding-principles/)
of testing software in a way that resembles real usage.

---

## Determinism

Tests must produce the same result when executed repeatedly under the same conditions.

Tests should not depend on:

- the current clock without explicit control;
- real random values;
- live external APIs;
- arbitrary delays;
- execution order;
- shared mutable state;
- data left behind by previous tests.

Time, randomness, storage and external communication should be controlled through explicit test boundaries.

---

## Test Isolation

Each test should establish its own state and clean up after itself.

A test must not depend on another test running before it.

Shared setup is acceptable only when it improves clarity without hiding important context.

Tests should remain independently executable.

---

## Confidence over Quantity

More tests do not automatically provide more confidence.

Duplicated tests increase maintenance cost without necessarily protecting additional behavior.

Every test should defend a meaningful requirement, invariant, contract or regression.

Tests that no longer provide useful confidence should be improved or removed.

---

# Test Levels

The project uses four primary testing levels.

```text
End-to-End Tests
        ↑
Integration Tests
        ↑
Component Tests
        ↑
Unit Tests
```

Higher levels provide broader confidence but are slower and more expensive to maintain.

Lower levels provide faster and more precise feedback but cover less of the assembled system.

The test suite should contain many focused low-level tests and a smaller number of high-value end-to-end tests.

---

## Unit Tests

Unit tests verify isolated business behavior.

Typical targets include:

- Domain entities;
- Value Objects;
- business invariants;
- pure functions;
- reward probability calculations;
- Phase transitions;
- Workflow validation;
- mappers;
- deterministic utilities.

Unit tests should normally use Vitest.

They should avoid React, browser contexts and real persistence unless those technologies are the unit being tested.

Example:

```ts
describe('rollReward', () => {
    it('selects a side according to configured probabilities', () => {
        const dice = createRewardDice({
            sides: [
                { title: 'Tea', probability: 0.75 },
                { title: 'Long break', probability: 0.25 },
            ],
        });

        const reward = rollReward(dice, () => 0.8);

        expect(reward.title).toBe('Long break');
    });
});
```

Randomness is injected so the behavior remains deterministic.

---

## Component Tests

Component tests verify React behavior from the user's perspective.

Typical targets include:

- forms;
- dialogs;
- Workflow editor controls;
- Reward Dice configuration;
- accessible keyboard interaction;
- validation feedback;
- loading, empty and error states.

Component tests should use Vitest and React Testing Library.

They should prefer:

- roles;
- accessible names;
- labels;
- visible text;
- realistic user interaction.

They should avoid direct assertions against internal component state.

React Testing Library is intentionally designed to encourage tests that
resemble actual usage instead of testing component internals.

---

## Integration Tests

Integration tests verify collaboration between multiple modules.

Typical targets include:

- Application use cases with repository test doubles;
- Presentation connected to Application services;
- repository implementations with a test database;
- typed messaging contracts;
- serialization and validation boundaries;
- Workflow import and migration flows;
- Session persistence and restoration.

Integration tests should use real collaborating modules whenever practical.

Only external or unstable boundaries should be replaced with controlled test implementations.

Example boundary:

```text
WorkflowEditor
        ↓
UpdateWorkflowUseCase
        ↓
InMemoryWorkflowRepository
```

The test verifies the interaction between Presentation and Application without requiring a real browser database.

---

## End-to-End Tests

End-to-end tests verify complete user journeys in a built extension.

Typical scenarios include:

- loading the extension;
- creating a Workflow;
- starting a Session;
- pausing and resuming execution;
- restoring active state after reopening an extension surface;
- configuring and rolling Reward Dice;
- importing and exporting a Workflow;
- persistence across side panel, options page and focus view;
- communication with the background service worker.

Playwright is used because its
[extension workflow](https://playwright.dev/docs/chrome-extensions) supports
loading Chromium extensions through a persistent browser context.

End-to-end tests should cover critical journeys rather than every possible branch.

They are the most expensive tests and should remain focused, reliable and intentionally limited.

---

# Test Distribution

The project follows a balanced testing strategy rather than pursuing arbitrary coverage targets.

Most tests should exist at the lowest level capable of proving the required behavior.

A healthy distribution generally consists of:

- many Unit Tests;
- fewer Component Tests;
- a limited number of Integration Tests;
- a small set of high-value End-to-End Tests.

Adding an End-to-End test should be a deliberate decision rather than the default solution.

---

# Test Doubles

Test doubles should be introduced only at architectural boundaries.

Prefer testing real implementations whenever practical.

Use:

- stubs for deterministic inputs;
- mocks for verifying interactions;
- fakes for infrastructure replacements;
- spies only when interaction verification is required.

Business logic should rarely require mocks.

External systems such as browser APIs, storage engines and network providers are appropriate candidates for test doubles.

---

# Chrome Extension Testing

The application executes across multiple independent extension contexts.

Testing should verify communication between:

- side panel;
- options page;
- focus view;
- background service worker.

Cross-context messaging should be treated as an integration boundary.

Extension-specific behavior should be verified through End-to-End tests rather than implementation-specific unit tests.

The current Playwright fixture loads the production extension and its real
background service worker, then opens the generated options, side-panel and
focus documents by their extension URLs. This verifies extension-origin
messaging, persistence and assembled page behavior. It does not reproduce
Chrome's side-panel container, toolbar UI or every `sidePanel.open()` and
`sidePanel.close()` interaction. Those browser-shell behaviors require focused
adapter tests and manual verification until the harness supports them directly.

---

# Time, Randomness and Timers

The application depends on time-based behavior and probabilistic reward generation.

Tests must remain deterministic.

Current time, timers and randomness should always be injectable or controllable.

Avoid relying on:

- real clocks;
- random number generators;
- arbitrary delays.

Deterministic execution is preferred over realistic timing.

---

# Persistence Testing

Persistence should be tested at repository boundaries.

Domain tests must not depend on storage technologies.

Repository implementations should verify:

- CRUD operations;
- migrations;
- serialization;
- deserialization;
- validation failures;
- corrupted data recovery where applicable.

Application use cases should depend only on repository contracts.

---

# Regression Tests

Every production bug should be accompanied by a regression test whenever practical.

The preferred workflow is:

1. reproduce the bug with a failing test;
2. implement the fix;
3. verify that the test passes.

Regression tests prevent previously solved problems from reappearing.

---

# Coverage

Coverage is an indicator rather than a goal.

High coverage does not guarantee correctness.

Low-value tests written solely to increase coverage should be avoided.

Priority should be given to testing:

- business rules;
- critical user journeys;
- architectural boundaries;
- historical regression areas.

---

# Test Organization

Tests should remain close to the code they verify.

Example:

```text
workflow/domain/
    Workflow.ts
    Workflow.test.ts

workflow/presentation/
    WorkflowEditor.tsx
    WorkflowEditor.test.tsx
```

End-to-End tests should be organized separately by user scenario rather than by implementation details.

Test names should describe expected behavior.

Preferred:

```text
creates a Workflow from a template
```

Avoid:

```text
Workflow Test #1
```

---

# Continuous Integration

Every Pull Request should execute the project's automated test suite.

At minimum, Continuous Integration should verify:

- type checking;
- linting;
- formatting;
- unit tests;
- component tests.

End-to-End tests may execute on a separate pipeline if execution time becomes significant.

No code should be merged while required quality gates are failing.

---

# Summary

Testing exists to support confident change.

The project values reliable, maintainable and deterministic tests over large quantities of fragile tests.

A successful testing strategy enables developers to evolve the application quickly while preserving confidence in its behavior.

The testing strategy should evolve together with the application, while remaining consistent with the project's architectural principles.
