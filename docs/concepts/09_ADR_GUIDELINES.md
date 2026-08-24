# ADR Guidelines

---

# Purpose

This document defines how Architectural Decision Records (ADRs) are created, maintained and evolved throughout the project.

Architectural decisions should not exist only in source code, pull requests or team discussions.

Important engineering decisions deserve durable documentation.

The purpose of an ADR is to explain:

- what decision was made;
- why it was made;
- which alternatives were considered;
- what consequences the decision introduces.

ADRs preserve architectural knowledge and reduce the need to rediscover past reasoning.

---

# What is an ADR?

An Architectural Decision Record captures one significant engineering decision.

Each ADR should describe a single decision.

An ADR is intentionally short.

Its purpose is to preserve reasoning rather than provide comprehensive documentation.

Architecture documents describe how the system is designed.

ADRs explain why specific architectural choices were made.

---

# When to Create an ADR

An ADR should be created whenever a decision is expected to influence the project over a long period of time.

Typical examples include:

- selecting a framework;
- choosing a persistence strategy;
- defining architectural boundaries;
- introducing a new integration;
- replacing a core technology;
- changing dependency direction;
- introducing cross-cutting infrastructure.

If reversing a decision would require significant effort, it probably deserves an ADR.

---

# When NOT to Create an ADR

An ADR should not be created for routine implementation decisions.

Examples include:

- variable names;
- UI layout changes;
- small refactoring;
- dependency updates;
- styling preferences;
- test implementation details.

The goal is to document architectural knowledge rather than implementation history.

---

# ADR Lifecycle

Every ADR progresses through a simple lifecycle.

```text
Proposed
      ↓

Accepted
      ↓

Superseded
      ↓

Archived
```

Only Accepted ADRs define the current architecture.

Superseded ADRs remain part of the project's historical record.

They should never be deleted.

---

# ADR Statuses

Each ADR must declare its current status.

Supported statuses are:

- Proposed
- Accepted
- Superseded
- Archived

Status changes should be explicit and recorded within the ADR itself.

---

# Writing Guidelines

Every ADR should:

- describe one decision;
- explain the motivation;
- evaluate realistic alternatives;
- document trade-offs;
- describe expected consequences;
- remain understandable years later.

ADRs should be concise.

Long discussions belong in supporting documentation rather than the ADR itself.

---

# ADR Template

Every ADR should follow the same structure.

```md
# ADR-0001

Title

Status

Date

---

## Context

Which problem are we solving?

---

## Decision

What was decided?

---

## Alternatives Considered

Option A

Option B

Option C

---

## Consequences

Benefits

Drawbacks

Trade-offs

---

## Related Documents

Links to architecture documents or previous ADRs.

---

## Supersedes

(optional)

---

## Superseded By

(optional)
```

---

# Updating ADRs

Accepted ADRs should not be rewritten.

If architectural direction changes, create a new ADR.

The new ADR should reference the previous one.

Architecture evolves by recording new decisions rather than rewriting history.

Historical reasoning remains valuable even when the decision is no longer current.

---

# Directory Structure

ADR files should be stored under:

```text
docs/
└── adr/
    ├── ADR-0001-use-wxt.md
    ├── ADR-0002-layered-architecture.md
    ├── ADR-0003-offline-first.md
    └── ...
```

ADR numbers should remain stable.

File names should briefly describe the decision.

---

# ADR Index

Current records and their statuses are listed in
[`docs/adr/README.md`](../adr/README.md). New ADR numbers are allocated from that
index and must not reuse a number from a Superseded or Archived record.

---

# Summary

Architectural decisions should be intentional, documented and traceable.

ADRs capture the reasoning behind important engineering choices and preserve knowledge beyond individual contributors.

The goal is not to document every decision.

The goal is to ensure that significant architectural choices remain understandable throughout the lifetime of the project.

---

## Guiding Principle

Good architecture is not defined by never changing decisions.

Good architecture is defined by making changes consciously and preserving the reasoning behind them.
