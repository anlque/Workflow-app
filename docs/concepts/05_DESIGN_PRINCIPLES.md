# Purpose

This document defines the engineering principles that guide technical decisions throughout the project.

Unlike the Architecture document, which defines how the system is organized, these principles describe how software should be designed and implemented within that architecture.

The principles in this document are intentionally technology-independent.

They apply regardless of the frameworks, libraries or tools used by the project.

Their purpose is to promote consistency, readability, maintainability and long-term evolution of the codebase.

These principles should guide everyday engineering decisions, code reviews, refactoring efforts and future architectural evolution.

When multiple technically correct solutions exist, the one that best aligns with these principles should generally be preferred.

The principles described here are intended to complement—not replace—professional engineering judgment.

# Core Principles

Core principles define the engineering philosophy of the project.

They influence architectural decisions, implementation details and code reviews.

Whenever multiple valid solutions exist, the one that better aligns with these principles should generally be preferred.

---

## Business First

Technical decisions should serve business goals rather than dictate them.

Business concepts are the primary organizing principle of the application.

Technologies, frameworks and implementation details are replaceable.

Business rules, however, represent the core value of the project and should remain independent from infrastructure whenever practical.

When evaluating alternative designs, preference should be given to the one that expresses business intent more clearly.

---

## Simplicity

Every solution should be as simple as possible while fully satisfying the current requirements.

Simple software is easier to understand, test, maintain and extend.

Complexity should never be introduced merely to anticipate possible future needs.

Reducing unnecessary abstractions is generally preferable to introducing additional layers.

Simplicity should not be confused with sacrificing correctness or maintainability.

---

## Incremental Complexity

Complexity should grow only when justified by real requirements.

The project should evolve through small, deliberate improvements rather than large speculative designs.

New abstractions should appear only after repeated patterns demonstrate a genuine need.

The preferred strategy is evolutionary design rather than designing for every possible future scenario.

This principle combines the ideas behind KISS, YAGNI and evolutionary architecture.

---

## Explicitness

Software should communicate its intent clearly.

Dependencies, state transitions, ownership and module boundaries should be explicit rather than implicit.

Hidden behavior, surprising side effects and implicit assumptions make software harder to reason about.

Code is generally easier to maintain when behavior is visible rather than inferred.

Explicit solutions are preferred even when they require slightly more code.

---

## Single Responsibility

Every module, type and function should have one primary responsibility.

Responsibilities should remain cohesive and well-defined.

When a component begins solving multiple unrelated problems, it should usually be decomposed into smaller parts.

Clear responsibilities improve readability, testing and future evolution.

---

## High Cohesion, Low Coupling

Related behavior should remain close together.

Unrelated concerns should remain independent.

Modules should expose small public surfaces while minimizing knowledge of other parts of the system.

Reducing coupling allows individual modules to evolve with minimal impact on the rest of the application.

---

## Composition over Inheritance

Behavior should generally be assembled through composition rather than inheritance.

Composition produces more flexible, reusable and testable software.

Inheritance should be reserved for situations where it represents a genuine "is-a" relationship rather than a mechanism for code reuse.

---

## Encapsulation

Every module owns its internal implementation.

Only intentionally designed public behavior should be visible outside the module.

Internal implementation details should remain private so they can evolve without affecting external consumers.

Good encapsulation reduces accidental coupling and simplifies refactoring.

---

## Local Reasoning

A developer should be able to understand a piece of code without navigating large portions of the project.

Behavior should be predictable from the local context.

Dependencies should be explicit and modules should avoid relying on hidden global knowledge.

The less context required to understand a module, the easier it is to maintain and review.

# Code Design Principles

Code design principles describe how individual modules, functions and types should be designed.

These principles help produce software that is predictable, testable and easy to evolve over time.

---

## Immutability by Default

Objects and data structures should be treated as immutable whenever practical.

Instead of modifying existing state, prefer creating new values that represent the updated state.

Immutable data reduces unintended side effects, simplifies reasoning and makes behavior more predictable.

Mutable state should exist only where it provides clear practical benefits.

---

## Prefer Pure Functions

Functions should produce the same result for the same input whenever possible.

Pure functions are easier to understand, test and reuse because they do not depend on hidden state or produce unexpected side effects.

Side effects such as I/O, persistence or browser interactions should be isolated at the boundaries of the application.

---

## Dependency Inversion

High-level business logic should depend on abstractions rather than concrete implementations.

Modules should define the contracts they require instead of depending directly on specific technologies.

Concrete implementations should remain replaceable without affecting business behavior.

This principle reduces coupling and improves testability.

---

## Small Public APIs

Every module should expose only the functionality that is intentionally designed for external use.

Internal implementation details should remain private.

Smaller public APIs reduce accidental coupling and allow internal refactoring without affecting consumers.

Public APIs should evolve carefully because they represent stable contracts between modules.

---

## Explicit Dependencies

A module's dependencies should be visible from its public interface or constructor.

Hidden dependencies make behavior difficult to understand and increase coupling.

Engineers should not need to inspect internal implementation to discover what a module depends on.

Whenever practical, dependencies should be injected rather than created internally.

---

## Stable Abstractions

Abstractions should emerge from stable business concepts rather than implementation details.

Interfaces should represent long-lived behaviors instead of temporary technical solutions.

Creating abstractions too early often introduces unnecessary complexity.

Abstractions should appear only after repeated patterns demonstrate a genuine need.

---

## Prefer Value Objects

Whenever identity is not required, prefer immutable value objects over entities.

Value objects are easier to reason about, compare and validate because they represent data rather than identity.

Identity should be introduced only when it has clear business meaning.

---

## Minimize Side Effects

Side effects should be isolated and easy to identify.

Business logic should avoid directly interacting with storage, browser APIs, network requests or other external systems.

Keeping side effects at the edges of the application improves predictability and simplifies testing.

---

## Favor Declarative Code

Code should describe *what* is being achieved rather than *how* every step is performed.

Declarative solutions generally communicate intent more clearly and reduce implementation noise.

Imperative code remains appropriate when it significantly improves clarity or performance.

---

## Design for Change

Software should be designed to accommodate expected evolution without unnecessary complexity.

Modules should be cohesive, loosely coupled and easy to modify independently.

The goal is not to predict every future requirement, but to make future change inexpensive when it becomes necessary.

---

## Prefer Domain Language

Names should reflect the language of the business domain rather than technical implementation.

Modules, types and functions should describe real business concepts whenever possible.

Using a consistent domain vocabulary improves communication between engineers and keeps the code closely aligned with the product model.

Technical terminology should be introduced only when it represents genuine technical concerns.

# State Management Principles

State is one of the primary sources of software complexity.

These principles define how state should be created, owned, updated and shared throughout the application.

The goal is to keep application behavior predictable, understandable and easy to maintain.

---

## Single Source of Truth

Every piece of state should have a single authoritative owner.

Duplicating mutable state across multiple modules increases the risk of inconsistencies and synchronization issues.

Whenever possible, other modules should derive the information they need from the original source rather than maintaining their own copies.

---

## State Ownership

Every state value should have a clearly defined owner.

The owner is responsible for creating, updating and exposing the state.

Other modules should interact with the state only through the owner's public interface.

Ownership should always be obvious from the architecture.

---

## Derived State

Derived data should be computed rather than stored whenever practical.

Storing information that can be calculated from existing state increases the likelihood of inconsistencies.

Computed values should remain deterministic and inexpensive to produce.

When computation becomes expensive, optimization should be introduced deliberately rather than prematurely.

---

## Predictable State Transitions

State should change only through explicit, well-defined operations.

Transitions should be deterministic and easy to follow.

A reader should be able to understand how a state changes without searching across unrelated modules.

Implicit mutations and hidden state transitions should be avoided.

---

## Keep State Close to Its Usage

State should live as close as possible to the code that owns and uses it.

Local state is generally preferable to shared state.

Shared state should be introduced only when multiple independent modules genuinely require access to the same information.

Keeping ownership local reduces coupling and simplifies reasoning.

---

## Separate Business State from UI State

Business state and presentation state represent different concerns.

Business state models the application's behavior and should remain independent of the user interface.

Presentation state exists only to support rendering and user interactions.

These responsibilities should remain separate to avoid unnecessary coupling between business logic and the UI.

---

## Minimize Shared Mutable State

Shared mutable state should be introduced only when it provides clear value.

The more modules can modify the same data, the harder the system becomes to understand.

Whenever practical, prefer immutable data flows and explicit ownership over globally mutable state.

---

## State Lifetime Should Be Explicit

Every state should have a clearly defined lifecycle.

Examples include:

- temporary UI state;
- workflow state;
- active session state;
- persisted application settings;
- cached external data.

Understanding when state is created, updated and discarded makes the application easier to reason about and reduces resource leaks.

---

## Prefer Events over Direct Mutation

Modules should communicate important state changes through well-defined events or application operations rather than directly modifying another module's internal state.

This keeps ownership boundaries clear and reduces accidental coupling.

The communication mechanism is an implementation detail and may vary depending on the architecture.

---

## Avoid Hidden State

Behavior should not depend on state that is difficult to discover.

Global variables, implicit caches and hidden mutable singletons increase cognitive load and make debugging significantly harder.

State should always have an identifiable owner and a well-defined access path.

---

## State Should Reflect Reality

Application state should represent the current business reality rather than anticipated future scenarios.

Temporary assumptions, speculative flags and transitional values should be avoided unless they represent genuine business concepts.

The state model should remain as small and truthful as possible.

Whenever possible, represent facts instead of intentions.

---

# Type Safety

Types should communicate domain meaning, constrain invalid operations and make assumptions visible.

Type safety is not only a compiler concern.

It is a design tool that helps prevent invalid states, document intent and reduce the number of runtime errors.

---

## Illegal States Should Be Unrepresentable

The type system should prevent invalid combinations of data whenever practical.

Instead of representing multiple mutually exclusive states through independent flags, prefer explicit variants.

Poor:

```ts
type SessionState = {
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
};
```

Preferred:

```ts
type SessionState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: Date }
  | { status: 'paused'; pausedAt: Date }
  | { status: 'completed'; completedAt: Date };
```

The preferred model makes valid transitions easier to understand and prevents contradictory states.

---

## Precise Types over Generic Types

Types should express the narrowest valid set of values.

Prefer domain-specific types and explicit unions over broad primitives.

Poor:

```ts
type Phase = {
  type: string;
  duration: number;
};
```

Preferred:

```ts
type PhaseType = 'focus' | 'break';

type Phase = {
  type: PhaseType;
  durationMinutes: number;
};
```

Primitive values should be replaced with stronger domain types when doing so prevents meaningful classes of errors.

---

## Runtime Validation at Boundaries

Static types do not validate runtime data.

Data received from storage, browser APIs, messages, imported files or external providers must be validated before entering trusted application code.

After successful validation, internal code may rely on the resulting type.

Validation should occur at system boundaries rather than being repeated throughout the application.

---

## Avoid `any`

The `any` type disables meaningful type checking and should not be used in application code.

Prefer:

- precise types;
- generics;
- discriminated unions;
- `unknown` with explicit narrowing.

When working with untrusted values, use `unknown`.

Example:

```ts
function parseMessage(value: unknown): RuntimeMessage {
  return runtimeMessageSchema.parse(value);
}
```

Temporary use of `any` during migration or third-party integration must remain isolated and documented.

---

## Prefer Explicit Domain Types

Domain concepts should have their own types even when their runtime representation is primitive.

For example:

```ts
type WorkflowId = string;
type SessionId = string;
```

Stronger wrappers or branded types may be introduced when accidental substitution represents a realistic risk.

```ts
type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

type WorkflowId = Brand<string, 'WorkflowId'>;
type SessionId = Brand<string, 'SessionId'>;
```

Such types should be introduced only when they improve correctness without adding disproportionate complexity.

---

## Prefer Discriminated Unions

Mutually exclusive states and outcomes should generally be modeled with discriminated unions.

Example:

```ts
type LoadWorkflowResult =
  | { status: 'success'; workflow: Workflow }
  | { status: 'not-found' }
  | { status: 'failure'; error: WorkflowLoadError };
```

This makes every possible outcome explicit and enables exhaustive handling.

---

## Exhaustive Handling

All variants of a closed union should be handled explicitly.

Example:

```ts
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function getPhaseLabel(type: PhaseType): string {
  switch (type) {
    case 'focus':
      return 'Focus';

    case 'break':
      return 'Break';

    default:
      return assertNever(type);
  }
}
```

Exhaustive checks ensure that newly introduced variants cannot be silently ignored.

---

## Avoid Unsafe Type Assertions

Type assertions should not be used merely to silence compiler errors.

Poor:

```ts
const workflow = value as Workflow;
```

A type assertion is justified only when correctness is established by an invariant the compiler cannot express.

Whenever runtime data is involved, validation or narrowing is required instead.

---

## Distinguish Optional, Missing and Nullable Values

Optional and nullable values should represent deliberate semantics.

These states may differ:

- a property was not provided;
- a value is explicitly absent;
- a value has not been loaded;
- a lookup produced no result.

The model should make these distinctions explicit when they affect behavior.

Avoid using `null`, `undefined` and empty values interchangeably without a defined convention.

---

## Types Should Follow Ownership Boundaries

Types belong to the module that owns the concept.

Shared types should contain only business-independent concepts.

A type must not be moved into `shared` merely because several modules import it.

Other modules should obtain feature-owned types through the owning feature's public API.

---

## Generated Types Are Boundary Types

Types generated from schemas, storage formats or external APIs should not automatically become domain types.

Generated models represent external contracts.

They should be mapped into domain concepts when their shape or semantics differ from the internal model.

This prevents external formats from controlling the application's business design.

---

## Type Complexity Must Be Justified

Advanced type-level programming should be used only when it materially improves correctness or developer experience.

Types should remain understandable to engineers working on the project.

A simpler explicit type is preferable to a clever abstraction that is difficult to interpret, debug or maintain.

---

## Error Messages Should Be Written for Humans

Error messages should explain the problem clearly and precisely.

They should avoid vague descriptions such as:

- Something went wrong
- Unknown error
- Invalid operation

Whenever practical, an error message should answer three questions:

- What happened?
- Why did it happen?
- What can be done next?

Well-written messages reduce debugging time and improve the overall developer experience.

---

# Asynchronous Programming

Asynchronous operations introduce uncertainty in execution order, timing and failure scenarios.

These principles help keep asynchronous behavior predictable, explicit and easy to reason about.

The goal is to minimize hidden concurrency issues and make asynchronous workflows reliable.

---

## Explicit Async Boundaries

Asynchronous behavior should be visible in the code.

Functions that perform asynchronous work should expose that fact explicitly through their interface.

Hidden asynchronous behavior makes execution flow difficult to understand and debug.

---

## Cancellation

Long-running operations should support cancellation whenever interruption is a realistic scenario.

Cancellation should leave the application in a consistent state.

Partially completed operations must not violate business invariants.

Cancellation itself should be treated as an expected outcome rather than an error.

---

## Idempotency

Operations that may be executed multiple times should produce the same result whenever practical.

Retries, duplicate messages and repeated user actions should not unintentionally create inconsistent state.

Idempotent operations improve reliability in distributed and asynchronous environments.

---

## Timeouts

Operations that depend on external systems should have clearly defined timeout behavior.

The application should never wait indefinitely for a response when progress cannot be guaranteed.

Timeout handling should be explicit and appropriate for the operation being performed.

---

## Retry Policy

Retries should be deliberate rather than automatic.

Only transient failures should be retried.

Permanent failures should surface immediately instead of consuming unnecessary resources.

Retry strategies should avoid creating duplicate side effects or excessive load.

---

## Avoid Race Conditions

Concurrent operations should not produce different results depending on execution order.

Whenever multiple operations may affect the same state, ownership and synchronization should be explicit.

Business logic should remain deterministic regardless of scheduling differences.

---

## Sequential When Order Matters

Operations that depend on one another should execute in a clearly defined order.

Parallel execution should be used only when operations are independent.

Correctness should always take priority over concurrency.

---

## Isolate Side Effects

External interactions such as storage, browser APIs and messaging should remain isolated from business logic whenever practical.

Keeping side effects at architectural boundaries makes asynchronous behavior easier to understand and test.

---

## Consistent Completion Semantics

Every asynchronous operation should have a clearly defined outcome.

Possible outcomes may include:

- success;
- expected cancellation;
- timeout;
- recoverable failure;
- unrecoverable failure.

The caller should always know which outcomes are possible and how they should be handled.

---

## Avoid Fire-and-Forget Operations

Background operations should not be started without a clear ownership model.

Whenever asynchronous work is intentionally detached from the caller, its lifecycle, error handling and completion strategy should remain explicit.

Fire-and-forget behavior should be the exception rather than the default.

---

## Asynchronous Boundaries Should Be Observable

Asynchronous workflows should expose enough information to support diagnostics and debugging.

Important operations should make their lifecycle observable through appropriate logging, events or progress reporting when this improves maintainability.

The chosen mechanism is an implementation detail and should remain independent of these principles.

---

## Avoid Hidden Background Work

Background execution should always have a clear owner and purpose.

Work that continues after the initiating action has completed should be intentional and easy to discover.

Engineers should be able to identify why background work exists, who initiated it and under which conditions it finishes.

Hidden background activity increases resource usage, complicates debugging and may lead to inconsistent application behavior.

---

# Performance Principles

Performance should be considered throughout the design of the system rather than treated as a collection of isolated optimizations.

The primary goal is to deliver predictable, responsive and efficient software while preserving readability and maintainability.

Performance improvements should always be justified by measurable benefits.

---

## Measure Before Optimizing

Performance decisions should be based on observation rather than assumptions.

Before introducing optimizations, identify the actual bottleneck through profiling, benchmarking or real-world measurements.

Optimization without evidence often increases complexity without improving user experience.

---

## Correctness Before Performance

Correct software is always preferable to fast but incorrect software.

Performance optimizations must never compromise business rules, architectural boundaries or data integrity.

When a trade-off exists, correctness should generally take priority.

---

## Optimize Where It Matters

Not every part of the application requires the same level of optimization.

Engineering effort should focus on operations that have a meaningful impact on responsiveness, resource usage or user experience.

Rarely executed code should remain simple unless measurement demonstrates otherwise.

---

## Prefer Efficient Design Over Micro-Optimizations

Architectural decisions have a far greater impact on performance than low-level implementation details.

Reducing unnecessary work, choosing appropriate algorithms and designing clear ownership boundaries generally provide greater long-term benefits than micro-optimizations.

---

## Avoid Unnecessary Work

The fastest operation is the one that never executes.

Avoid repeated calculations, redundant rendering, unnecessary state updates and duplicate requests whenever practical.

Work should only be performed when it produces meaningful value.

---

## Lazy Initialization

Resources should be created only when they are actually required.

Deferring expensive work reduces startup time and avoids consuming memory or CPU for unused functionality.

Lazy initialization should remain explicit and predictable.

---

## Cache Deliberately

Caching is a performance optimization, not a default design strategy.

Every cache should have:

- a clear owner;
- an invalidation strategy;
- a defined lifetime;
- measurable benefits.

Uncontrolled caches often introduce stale data, hidden complexity and increased memory usage.

---

## Minimize Memory Retention

Objects should not remain in memory longer than necessary.

State, listeners and cached resources should be released when they are no longer needed.

Reducing unnecessary memory retention improves responsiveness and simplifies lifecycle management.

---

## Avoid Premature Optimization

Optimization should not be introduced before a genuine performance problem exists.

Simple, readable solutions are generally preferable during early development.

Additional complexity should appear only when supported by evidence.

---

## Performance Should Be Predictable

Application performance should remain stable under normal operating conditions.

Large and unexpected variations in response time are often more harmful than consistently moderate performance.

Predictable behavior improves both user experience and system reliability.

---

## Performance Is a Shared Responsibility

Performance is influenced by every layer of the application.

Domain models, application workflows, infrastructure, persistence and presentation all contribute to overall responsiveness.

Optimization should therefore be approached as a system-wide concern rather than the responsibility of a single module.

---

## Optimize for the Common Case

Optimization efforts should primarily improve the scenarios users encounter most frequently.

Design decisions should favor common workflows over rare edge cases unless those edge cases have significant business impact.

Improving the performance of the typical user journey usually provides greater value than optimizing exceptional situations.

---

## Simplicity Is Often the Best Optimization

Simple software tends to perform well because it performs less work.

Reducing unnecessary abstractions, duplicate state and excessive coordination often improves both performance and maintainability.

Whenever possible, eliminate unnecessary work before attempting to make existing work faster.

---

# Maintainability

Software is read, modified and extended far more often than it is written.

Maintainability should therefore be considered a primary engineering goal rather than a secondary concern.

Every design decision should aim to reduce future complexity and make change less expensive.

---

## Readability over Cleverness

Code should communicate intent clearly.

A straightforward solution is generally preferable to a shorter or more sophisticated implementation that requires additional effort to understand.

Future maintainers should not need to solve a puzzle in order to modify the code.

---

## Refactor Continuously

Refactoring is a normal part of software development.

Small, incremental improvements should accompany feature development whenever they increase clarity, reduce duplication or improve structure.

Large refactoring efforts become less necessary when the codebase evolves continuously.

---

## Consistency over Individual Preference

Consistency across the project is more valuable than personal coding style.

Engineers should follow established project conventions even when alternative approaches are equally valid.

A predictable codebase reduces cognitive load and simplifies collaboration.

---

## Small Modules

Modules should remain focused on a single responsibility.

Smaller modules are generally easier to understand, test and evolve independently.

When a module begins accumulating unrelated responsibilities, it should usually be decomposed into smaller parts.

---

## Explicit Ownership

Every significant concept should have a clearly identifiable owner.

Ownership includes responsibility for implementation, maintenance and future evolution.

Unclear ownership often leads to duplicated logic, conflicting implementations and architectural drift.

---

## Minimize Cognitive Load

Code should require as little mental context as possible.

A developer should be able to understand most modules without navigating large portions of the project.

Reducing cognitive load improves productivity, onboarding and long-term maintainability.

---

## Prefer Evolution over Rewrites

Healthy software evolves through continuous improvement.

Large-scale rewrites should remain exceptional.

Existing designs should be improved incrementally whenever practical instead of being replaced entirely.

Incremental evolution preserves knowledge, reduces risk and allows continuous delivery of value.

---

## Keep Documentation Close to Reality

Documentation should accurately describe the current behavior of the system.

Outdated documentation creates false confidence and often causes more harm than having no documentation at all.

Documentation should evolve together with the software.

---

## Design for Future Engineers

Code should be written for the engineers who will maintain it in the future.

Future maintainers may have different experience, assumptions or familiarity with the project.

Clarity, consistency and explicitness help ensure that the code remains approachable over time.

---

## Prefer Removal over Addition

Removing unnecessary code, abstractions and dependencies is often more valuable than introducing new ones.

Every additional concept increases the amount of software that must be understood and maintained.

When two solutions provide similar value, the simpler one with fewer moving parts is generally preferable.

---

## Technical Debt Should Be Intentional

Technical debt should never accumulate accidentally.

When compromises are necessary, they should be explicit, documented and revisited when appropriate.

Intentional technical debt is easier to manage than hidden architectural decay.

---

## Maintainability Is a Feature

Maintainability directly affects the long-term quality of the product.

Software that is easy to modify can adapt more quickly to changing requirements, fix defects faster and remain reliable as it evolves.

Engineering decisions should therefore consider maintainability alongside functionality, correctness and performance.

---

## Leave the Code Better Than You Found It

Whenever modifying existing code, strive to leave it in a slightly better state than before.

Small improvements made consistently over time have a significant cumulative effect.

Improvement does not require large refactoring efforts.

Renaming unclear variables, simplifying logic, improving documentation or removing duplication are often sufficient to increase the overall quality of the codebase.

---

# Summary

The principles described in this document define the engineering philosophy of the project.

They complement the project's architecture by providing a consistent approach to designing, implementing and evolving software.

These principles intentionally remain independent of specific technologies, frameworks and implementation details.

As the project grows, individual tools and libraries may change.

The principles, however, are intended to provide a stable foundation for engineering decisions throughout the lifetime of the project.

Following these principles consistently helps create software that is:

- correct;
- understandable;
- maintainable;
- predictable;
- adaptable;
- resilient.

The purpose of these principles is not to restrict engineering creativity, but to provide a shared language for discussing design decisions and evaluating alternatives.

Ultimately, good engineering is not defined by strict adherence to rules, but by consistently making thoughtful decisions that improve the software over time.
