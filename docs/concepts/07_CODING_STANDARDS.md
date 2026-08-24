# Purpose

This document defines the coding conventions used throughout the project.

Its purpose is not to replace engineering judgment or architectural principles.

Instead, it establishes a consistent style of implementation that makes the codebase easier to read, review and maintain.

Consistency is valued more highly than individual coding preferences.

Whenever multiple implementations are equally valid, engineers should prefer the one that aligns with these standards.

These conventions complement the project's Design Principles rather than duplicate them.

Coding standards describe how code should be written.

Design principles describe why it should be written that way.

Good code should be unsurprising.

A developer familiar with the project should generally predict where code belongs, how it is written and how it behaves before opening the file.

---

# General Principles

Code should be written primarily for humans rather than compilers.

Every implementation should strive to communicate intent clearly.

The preferred solution is usually the one that is easiest to understand, modify and verify.

Whenever possible, code should:

- be explicit;
- remain predictable;
- avoid unnecessary abstraction;
- minimize cognitive load;
- express business intent directly.

Consistency across the codebase is more valuable than personal coding style.

Small improvements made consistently over time are encouraged.

Whenever modifying existing code, leave it in a slightly better state than before.

---

# Naming Conventions

Names should communicate purpose rather than implementation.

A reader should understand the responsibility of a symbol without reading its implementation.

Prefer descriptive names over abbreviated ones.

Avoid generic names such as:

- data
- item
- object
- helper
- util
- manager

unless they accurately describe the concept.

Boolean values should read naturally.

Examples:

- isOpen
- hasAccess
- canRetry
- shouldPersist

Functions should describe actions.

Examples:

- createWorkflow
- loadSession
- validateImport
- saveSettings

Types should represent business concepts.

Examples:

- Workflow
- Session
- Environment
- RewardDice

Avoid technology-oriented names when a business concept exists.

Prefer:

WorkflowRepository

over

DexieWorkflowService

| Element | Convention | Example |
|----------|------------|---------|
| Directories | kebab-case | `book-details`, `reward-dice` |
| Primary-symbol files | Match exported symbol | `WorkflowCard.tsx`, `RewardDice.ts`, `WorkflowRepository.ts` |
| Function and utility files | camelCase | `createWorkflow.ts`, `rollReward.ts` |
| React Components | PascalCase | `WorkflowEditor` |
| Interfaces | PascalCase | `WorkflowRepository` |
| Types | PascalCase | `WorkflowId`, `SessionState` |
| Type Aliases | PascalCase | `RewardProbability` |
| Enums | PascalCase | `SessionStatus` |
| Enum Members | PascalCase | `SessionStatus.Running` |
| Classes | PascalCase | `WorkflowFactory` |
| Functions | camelCase | `createWorkflow()` |
| Variables | camelCase | `activeSession` |
| Function Parameters | camelCase | `workflowId` |
| Object Properties | camelCase | `remainingSeconds` |
| Hooks | camelCase with `use` prefix | `useActiveSession()` |
| Refs | camelCase with `Ref` suffix | `timerRef` |
| Event Handlers | `handle` prefix | `handleStartClick()` |
| Async Functions | No special prefix | `loadWorkflow()` |
| Boolean Variables | `is`, `has`, `can`, `should` | `isRunning`, `hasMedia` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_WORK_DURATION` |
| Generic Type Parameters | Descriptive PascalCase | `TEntity`, `TResult`, `TError` |
| CSS Variables | kebab-case | `--environment-background` |
| Tailwind Design Tokens | kebab-case | `background-primary` |
| Environment Variables | UPPER_SNAKE_CASE | `VITE_UNSPLASH_ACCESS_KEY` |
| Test Files | Match source + `.test.ts(x)` | `Workflow.test.ts`, `rollReward.test.ts` |
| E2E Test Files | Journey name + `.spec.ts` | `workflowExecution.spec.ts` |
| Mock Files | Match owned concept + `.mock.ts` | `WorkflowRepository.mock.ts` |
| Barrel Files | `index.ts` | `index.ts` |

## Additional Naming Rules

- Avoid abbreviations unless they are universally understood.
- Prefer business terminology over technical terminology.
- Prefer nouns for types and entities.
- Prefer verbs for functions.
- Avoid names that expose implementation details.
- Avoid redundant prefixes and suffixes.
- Acronyms should follow normal PascalCase and camelCase rules.

Preferred:

- `HttpClient`
- `WorkflowId`
- `ApiResponse`

Avoid:

- `HTTPClient`
- `workflow_id`
- `IData`
- `UtilManager`
- `HelperService`

## One Concept — One Name

The same business concept should always have the same name throughout the project.

For example, if the business domain defines a `Workflow`, it should never be referred to elsewhere as:

- Flow
- Pipeline
- Routine
- Timer Configuration

Consistency in terminology reduces cognitive load and prevents accidental duplication of concepts.

This rule applies equally to:

- source code;
- documentation;
- commit messages;
- pull requests.

Consistent language improves communication across the entire project.

---

# Project Organization

The project structure should communicate architecture.

A developer should be able to determine the responsibility of a module by its location before reading its implementation.

Directories represent architectural boundaries rather than technical groupings.

The folder hierarchy should remain shallow, predictable and easy to navigate.

---

## Ownership

Each directory should have a single clear responsibility.

Ownership should be explicit.

If multiple features require the same functionality, it should be moved to an appropriate shared location rather than duplicated.

---

## Cohesion

Files that change together should live together.

Modules that rarely interact should remain physically separated.

The project should optimize for local reasoning rather than global navigation.

---

## Feature Isolation

Each feature should encapsulate:

- presentation;
- application logic;
- infrastructure;
- public API.

Internal implementation details should not be imported directly from outside the feature.

Communication between features should occur only through explicitly exported public interfaces.

---

## Shared Code

Shared modules should contain only functionality that is genuinely shared across multiple independent features.

Code should never be moved to Shared simply because its future usage is uncertain.

Premature generalization should be avoided.

---

## Platform Layer

Platform modules provide integrations with external systems.

Examples include:

- browser APIs;
- storage engines;
- messaging;
- asset providers;
- timers.

Business logic must remain independent from platform implementations.

---

## Public APIs

Every feature should expose a minimal public API.

Consumers should import from the feature root rather than internal implementation files.

Preferred:

```ts
import { WorkflowEditor } from '@/features/workflow';
```

Avoid:

```ts
import { WorkflowEditor } from '@/features/workflow/ui/editor/components/WorkflowEditor';
```

Public APIs reduce coupling and make future refactoring significantly easier.

---

## Directory Evolution

New directories should appear only when they represent a genuinely new architectural concept.

Creating directories for temporary convenience should be avoided.

A directory should exist because it communicates ownership, not because it groups similar file types.

---

## Architectural Boundaries

Folder structure must reinforce architectural boundaries rather than weaken them.

Navigation through the project should naturally guide engineers toward the correct dependency direction.

Physical organization should support logical organization.

---

## Prefer Moving over Copying

If code is useful in another feature, first consider moving it to a more appropriate owner.

Copying implementation between features should be the last resort.

Shared code should emerge naturally from repeated usage rather than speculative design.

---

# TypeScript Standards

TypeScript is used to model the business domain rather than simply annotate JavaScript.

Types should communicate intent, constrain invalid states and support safe refactoring.

The compiler should prevent as many mistakes as practical before the application is executed.

TypeScript should improve software design rather than increase implementation complexity.

---

## Type Modeling

Types should represent business concepts.

Avoid using primitive values when a dedicated domain type improves clarity.

Preferred:

- WorkflowId
- SessionId
- AssetId
- DurationSeconds

instead of:

- string
- number

Business terminology should be reflected directly in the type system whenever practical.

---

## Type Safety

Strict type checking should remain enabled throughout the project.

Unsafe casts should be avoided.

The type system should express invariants whenever practical.

Compiler errors should be resolved by improving the design rather than bypassing the type checker.

---

## Immutability

Data should be immutable by default.

Prefer readonly properties whenever values are not intended to change.

Mutable state should exist only where mutation represents actual application behavior.

Immutability improves predictability, reasoning and refactoring safety.

---

## Function Signatures

Function signatures should describe behavior clearly.

Parameters should be explicit.

Return types should communicate possible outcomes.

Functions with many positional parameters should generally accept a typed object instead.

Preferred:

```ts

createWorkflow({
    name,
    phases,
    rewardDice,

});

```

Avoid:

```ts

createWorkflow(
    name,
    phases,
    rewardDice,

);

```
---

## Generic Types

Generic parameters should have descriptive names whenever they represent meaningful concepts.

Preferred:

TEntity
TResult
TError

Prefer descriptive generic names whenever they represent meaningful domain concepts.

Single-letter generic parameters are acceptable only when their meaning is universally understood or constrained to a very small scope.

---

## Runtime Validation

Compile-time types do not validate runtime data.

All external data should be validated before entering trusted application code.

TypeScript and runtime validation solve different problems and should complement one another.

---

## Avoid

Avoid:

- any
- unnecessary assertions
- non-null assertions
- overly broad union types
- duplicated type definitions
- magic string literals when domain types exist

Every escape hatch from the type system should require explicit engineering justification.

---

## Prefer Domain Types over Primitive Types

Primitive types should not become the language of the business domain.

For example:

```ts
type WorkflowId = string;
type SessionId = string;
type AssetId = string;
type DurationSeconds = number;
```

Although these aliases share primitive representations, they communicate significantly more business meaning.

As the project evolves, they may become richer domain types without requiring widespread refactoring.

---

## Prefer Type over Interface

Use `type` by default.

Use `interface` only when declaration merging or extension by third-party libraries is explicitly required.

Using one primary construct throughout the project improves consistency and reduces unnecessary decision-making.

---

## Prefer Unknown over Any

When the type is genuinely unknown, use `unknown` rather than `any`.

`unknown` preserves type safety by requiring explicit validation before use.

`any` disables the type system and should remain an exceptional escape hatch.

---

# Function Design

Functions are the primary building blocks of application behavior.

A well-designed function should communicate its purpose clearly, perform one coherent operation and produce predictable results.

The implementation should be easier to understand than the problem it solves.

---

## Single Responsibility

Each function should have one clear reason to change.

If a function performs several independent operations, consider splitting it into smaller functions.

A function may coordinate multiple steps if they belong to one business operation.

---

## Explicit Inputs

Functions should receive all required dependencies through their parameters.

Hidden dependencies make functions harder to understand, reuse and test.

Inputs should clearly describe what the function needs rather than where the data originates.

---

## Predictable Outputs

The return value should represent the result of the operation.

Functions should avoid modifying unrelated state or producing unexpected side effects.

Whenever practical, outputs should be deterministic for identical inputs.

---

## Prefer Pure Functions

Pure functions are easier to understand, test and reuse.

Whenever business logic does not require external state or side effects, prefer a pure implementation.

Side effects should remain isolated near architectural boundaries.

---

## Minimal Public API

Public functions should expose the smallest API necessary to perform their responsibility.

Internal implementation details should remain hidden.

Reducing the public surface simplifies future refactoring.

---

## Parameter Objects

Functions with several related parameters should prefer a typed parameter object.

Preferred:

```ts
createWorkflow({
    name,
    phases,
    rewardDice,
});
```

Avoid:

```ts
createWorkflow(
    name,
    phases,
    rewardDice,
);
```

Parameter objects improve readability and make future evolution safer.

---

## Early Returns

Prefer early returns over deeply nested conditional logic.

Reducing nesting makes execution flow easier to understand.

Preferred:

```ts
if (!workflow) {
    return;
}

startWorkflow(workflow);
```

Avoid:

```ts
if (workflow) {
    startWorkflow(workflow);
}
```

---

## Avoid Boolean Flags

Boolean parameters often indicate that a function performs multiple behaviors.

Instead of:

```ts
saveWorkflow(workflow, true);
```

Prefer:

```ts
saveWorkflow(workflow);
saveWorkflowAsTemplate(workflow);
```

Function names should communicate behavior explicitly.

---

## Side Effects

Functions that perform side effects should make that behavior obvious.

Examples include:

- persistence;
- browser APIs;
- network requests;
- timers;
- messaging.

Business logic should remain independent from these operations whenever practical.

---

## Error Handling

Functions should communicate failure explicitly.

Errors should not disappear silently.

Unexpected failures should propagate to an appropriate boundary.

---

## Naming

Function names should describe actions.

Examples:

- createWorkflow
- startSession
- validateImport
- loadSettings

Avoid generic names such as:

- process
- execute
- handleData
- doWork

unless they accurately describe the responsibility.

---

## Function Length

There is no strict line limit for functions.

A function is too large when its responsibility becomes difficult to understand.

Reducing cognitive complexity is more important than minimizing the number of lines.

---

## Composition over Complexity

Prefer composing several small functions rather than building one highly configurable function.

Small, focused functions are generally easier to test, reuse and maintain.

---

## Architectural Role

Functions should belong to the layer responsible for the behavior they implement.

Business rules belong to Domain.

Application coordination belongs to Application.

Side effects belong to Infrastructure.

Presentation functions should remain focused on rendering and user interaction.

---

## One Level of Abstraction

Each function should operate at a single level of abstraction.

High-level business logic should not be mixed with low-level implementation details.

Preferred:

```ts
startWorkflow(workflow);

notifyUser();

persistSession();
```

Instead of:

```ts
setTimeout(...);

chrome.storage.local.set(...);

updateState(...);
```

Keeping one level of abstraction per function improves readability and makes business intent immediately visible.

---

## Prefer Descriptive Composition

Reading a function should feel like reading a sequence of business actions.

Well-named helper functions often communicate intent more effectively than comments.

Good composition reduces the need to explain implementation details.

---

# Component Design

Components represent user interface composition rather than business behavior.

A component should describe what is rendered, not how the application works.

Business rules belong outside components whenever practical.

---

## Single Responsibility

Each component should represent one coherent UI concept.

Large components with several unrelated responsibilities should generally be decomposed into smaller components.

---

## Composition over Configuration

Prefer composing simple components rather than creating highly configurable components with numerous optional props.

Composition usually produces simpler APIs and clearer responsibilities.

---

## Keep Logic Close to Ownership

Presentation logic belongs inside components.

Business logic belongs to the Application or Domain layers.

Infrastructure concerns should remain outside components whenever practical.

---

## Minimize Props

Components should receive only the data required for rendering and interaction.

Passing unrelated data increases coupling and reduces reusability.

---

## Explicit APIs

Component APIs should remain small, predictable and well typed.

Every prop should have a clear purpose.

Avoid optional props that significantly alter component behavior.

---

## Prefer Controlled Components

Whenever user interaction affects application state, components should expose explicit inputs and outputs rather than managing hidden state.

---

## Prefer Declarative Components

Components should describe the desired UI state rather than the sequence of operations required to produce it.

Declarative components are generally easier to understand, test and evolve.

---

## Accessibility by Default

Components should use semantic HTML whenever possible.

Accessible behavior should be considered part of the component's responsibility rather than an optional enhancement.

---

## Avoid Deep Nesting

Deeply nested component trees often indicate missing composition opportunities.

Prefer extracting meaningful subcomponents over increasing nesting depth.

---

## Hooks

Custom hooks should encapsulate reusable behavior rather than reusable rendering.

Hooks should expose behavior through a clear API while remaining independent from presentation whenever practical.

---

## Architectural Role

Components belong exclusively to the Presentation layer.

They may coordinate interaction with the Application layer but should not implement business rules directly.

---

## Components Describe Intent

Reading a component should explain what the user sees rather than how the implementation works.

Well-designed components reduce the need for comments because their structure naturally communicates intent.

---

# Imports

Imports define architectural dependencies.

Every import should reinforce the intended dependency direction of the project.

The location of an import should immediately communicate the relationship between modules.

---

## Depend on Public APIs

Features should import only from another feature's public API.

Preferred:

```ts
import { WorkflowEditor } from '@/features/workflow';
```

Avoid:

```ts
import { WorkflowEditor } from '@/features/workflow/ui/editor/WorkflowEditor';
```

Public APIs preserve encapsulation and simplify future refactoring.

---

## Prefer Absolute Imports

Absolute imports improve readability and reduce dependency on directory depth.

Preferred:

```ts
import { Button } from '@/shared/ui';
```

Avoid:

```ts
import { Button } from '../../../../shared/ui';
```

---

## Keep Imports Organized

Imports should be grouped by responsibility.

Recommended order:

- External libraries
- Platform modules
- Shared modules
- Domain
- Application
- Features
- Local modules
- Styles

Separate groups with a single empty line.

---

## Avoid Circular Dependencies

Modules should not depend on each other cyclically.

Circular dependencies complicate reasoning, testing and future refactoring.

---

## Import Only What Is Needed

Avoid namespace imports unless they clearly improve readability.

Unused imports should never remain in the codebase.

---

## Architectural Boundaries

Imports must follow the project's architectural dependency rules.

Lower layers must never depend on higher layers.

Physical imports should reinforce logical architecture.

---

# Comments & Documentation

Code should communicate intent through its structure whenever possible.

Comments exist to explain decisions, constraints and reasoning rather than implementation details.

---

## Prefer Self-Documenting Code

Well-named types, variables and functions should reduce the need for comments.

If a comment merely repeats what the code already expresses, the code should usually be improved instead.

---

## Explain Why, Not What

Comments should explain:

- architectural decisions;
- business constraints;
- non-obvious trade-offs;
- external limitations.

Avoid comments that simply describe the implementation.

Preferred:

```ts
// Chrome alarms may fire after service worker restart.
```

Avoid:

```ts
// Increment counter.
counter++;
```

---

## Keep Documentation Current

Documentation should evolve together with the code.

Outdated comments are often more harmful than missing comments.

---

## Public APIs

Public modules, reusable utilities and exported abstractions should provide sufficient documentation for consumers.

Implementation details should remain internal.

---

# TODO Guidelines

TODO comments represent intentional future work.

They should never become permanent placeholders.

TODO comments should describe intended improvements rather than uncertain ideas.

If the future work is speculative, it belongs in project documentation rather than source code.

---

## Every TODO Should Explain Why

Preferred:

```ts
// TODO: Replace polling with browser alarms after synchronization is implemented.
```

Avoid:

```ts
// TODO
```

---

## Use Consistent Tags

Use:

- TODO
- FIXME
- NOTE

Avoid creating project-specific comment conventions without clear value.

---

## Keep TODOs Actionable

Every TODO should describe a concrete improvement.

Large future features belong in issue tracking rather than source code.

---

## Remove Completed TODOs

Completed TODOs should be removed immediately.

The codebase should not contain historical reminders.

---

# Code Review Expectations

Code review is a collaborative engineering activity.

Its purpose is to improve software quality, share knowledge and preserve architectural consistency.

---

## Review the Design

Reviews should evaluate:

- correctness;
- readability;
- maintainability;
- architectural consistency;
- testability.

Style issues should primarily be enforced through automated tooling.

---

## Prefer Constructive Feedback

Review comments should explain reasoning rather than personal preference.

Whenever practical, propose improvements instead of simply identifying problems.

---

## Protect Architectural Boundaries

Reviews should verify that new code respects:

- layer boundaries;
- ownership rules;
- public APIs;
- dependency direction.

Architectural consistency is more important than local optimization.

---

## Encourage Incremental Improvement

Perfect code is rarely achievable.

Small improvements made consistently over time have greater long-term value than occasional large refactoring efforts.

---

## Shared Responsibility

Code quality is the responsibility of the entire team.

Every approved change becomes part of the shared codebase.

---

# Summary

These coding standards establish a consistent implementation style across the project.

Their purpose is not to restrict creativity, but to reduce unnecessary variation and improve long-term maintainability.

Consistent coding practices make software easier to understand, review and evolve.

As the project grows, these standards may evolve together with the engineering practices of the team.

The ultimate goal is to produce software that remains understandable, maintainable and adaptable throughout its lifetime.
