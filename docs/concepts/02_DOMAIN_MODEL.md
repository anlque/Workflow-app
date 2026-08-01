# Domain Model

---

# Purpose

This document defines the core business entities of the application and the relationships between them.

The domain model represents the business itself rather than its implementation.

It must remain stable even if technologies, frameworks or storage solutions change.

Business rules belong to the domain model.

Implementation details do not.

---

# Design Principles

The domain model follows several fundamental principles.

# Entity Types

The domain model distinguishes between two kinds of domain objects.

## Entities

Entities have a stable identity and lifecycle.

They can be created, modified and referenced independently.

Examples:

- Workflow
- Session
- Asset
- Reward Dice Template

## Value Objects

Value Objects have no independent identity.

They exist only as part of an Entity.

Replacing a Value Object creates a new value rather than modifying an existing object.

Examples:

- Phase
- Environment
- Reward Dice
- Dice Side

## Business First

Entities represent concepts from the real world rather than implementation details.

Examples:

- Workflow
- Session
- Phase
- Environment

Examples of things that are **not** domain entities:

- React components
- Zustand stores
- IndexedDB tables
- API responses

---

## Stable Core

The domain should change more slowly than the surrounding application.

UI, storage and integrations may evolve independently.

The core business model should remain stable.

---

## Explicit Relationships

Relationships between entities should always be intentional and easy to understand.

The model should avoid hidden ownership and implicit dependencies.

---

# High-Level Domain

```text
Workflow (Entity)
│
├── owns
│     ▼
│   Phase (VO)
│        │
│        └── owns
│              ▼
│        Environment (VO)
│
├── owns
│     ▼
│   Reward Dice (VO)
│        │
│        └── owns
│              ▼
│        Dice Side (VO)
│
└── references
      ▼

   Asset (Entity)

Reward Dice Template (Entity)

↓

creates copy of

↓

Reward Dice (VO)

Workflow

↓

creates

↓

Session (Entity)
```

# Workflow (Entity)

Workflow is the central business entity.

A workflow describes **how** an activity should be performed.

A workflow contains configuration only.

It never represents a running execution.

Responsibilities:

- define workflow phases;
- own Reward Dice;
- reference Assets.

A workflow is a reusable template.

Starting a workflow creates a Session.

---

# Session (Entity)

Session represents one execution of a workflow.

A session is created when a user starts a workflow.

Responsibilities:

- execution state;
- current phase;
- phase timing anchors;
- pause state;
- completion status;
- immutable Workflow snapshot.

A Session is a durable execution record. At most one Session may be active.
Running, transitioning and paused Sessions are persisted so execution can be
restored after an extension surface closes or the background service worker
restarts. A transition lasts exactly one second after every Phase and is derived
from an absolute timestamp. Pauses carry a `user` or `reward` reason; only the
dedicated Reward continuation may resume a Reward pause. Completed and stopped
Sessions are retained as minimal history records.

Workflows are permanent.

---

# Phase (Value Object)

A Phase represents one step of a workflow execution.

MVP phase types are:

- Focus
- Break

Short Break and Long Break may exist as presentation presets. They are not
separate Domain types. Future versions may introduce additional phase types by
explicitly evolving the domain model and its serialized schemas.

A Phase defines:

- duration;
- associated Environment;
- future phase-specific behavior.

A Phase cannot exist independently from its parent Workflow.

---

# Environment (Value Object)

Environment describes the atmosphere in which a phase is executed.

It has no identity outside of its parent phase.

Responsibilities:

- reference background assets;
- reference audio assets;
- define colors;
- define visual configuration.

Environment never owns assets.

It only references them.

---

# Asset (Entity)

Asset represents reusable media.

Examples:

- image;
- audio;
- video;
- animation.

Each Asset has a stable identity and may be referenced by multiple Workflows.

---

# Reward Dice (Value Object)

Reward Dice represents the reward configuration of a specific Workflow.

It defines:

- available sides;

- probabilities;

- trigger frequency.

Reward Dice belongs exclusively to its parent Workflow.

It may be initialized from a Reward Dice Template, but after creation it is edited independently.

Changes to one Workflow's Reward Dice must never affect another Workflow.

---

# Reward Dice Template (Entity)

Reward Dice Template is a future-scope entity and is not implemented in the MVP.

Reward Dice Template is a reusable saved configuration.

It allows users to reuse reward setups without configuring them from scratch.

A template has its own identity and lifecycle.

Applying a template to a Workflow creates an independent Reward Dice copy.

Later changes to the template must not modify existing Workflows.

Later changes to a Workflow must not modify the original template.

---

# Dice Side (Value Object)

A Dice Side represents one possible reward outcome.

Each side defines:
- icon;
- title;
- probability.

Dice Sides belong exclusively to a Reward Dice.

They have no independent lifecycle.

---

# Entity Relationships

Workflow

owns

↓

Phase

owns

↓

Environment

references

↓

Asset


Reward Dice Template

creates copy of

↓

Reward Dice

owns

↓

Dice Sides


Workflow

creates

↓

Session

---

# Ownership Rules

Workflow owns:

- Phases;
- Reward Dice.

Each Phase owns exactly one Environment.

Reward Dice owns its Dice Sides.

Assets may be referenced by multiple Workflows.

Sessions belong to a single Workflow.

---

# Lifecycle

Workflow

Created

↓

Edited

↓

Saved

↓

Started

↓

Creates Session

↓

Session Executes

↓

Session Completes

↓

Workflow Remains Unchanged

Workflow is immutable during execution.

---

# Domain Rules

The following rules must always remain true.

A Workflow always belongs to exactly one Workflow Library.

For the MVP, Workflow Library names the repository-backed collection of local
Workflows. It is not a separately persisted Entity or aggregate.

A Workflow may create many Sessions.

A Session always references exactly one Workflow.

A Session stores an immutable snapshot of the Workflow configuration used when
it starts. Deleting or editing the source Workflow does not change an existing
Session.

A Workflow may contain multiple Phases.

A Workflow contains at least one ordered Phase. The MVP executes the ordered
sequence once. Each Phase has a positive duration and is either Focus or Break.

At most one Session may be active. Valid active states are Running and Paused.
Terminal states are Completed and Stopped.

Each Phase owns exactly one Environment.

Environment references Assets but never owns them.

Assets may be shared between many Workflows.

Deleting a Workflow must never automatically delete shared Assets.

A Workflow owns zero or one Reward Dice configuration.

Reward Dice may be disabled. When enabled it contains at least two Dice Sides,
has a trigger frequency of at least one completed Focus Phase and is evaluated
only after a completed Focus Phase.

Dice Side probabilities are positive decimal weights. The Domain normalizes
custom weights; when weights are omitted, all sides receive equal weight.

Reward Dice owns its Dice Sides.

A Reward Dice Template may be used to initialize many Workflows.

Applying a Reward Dice Template creates an independent copy.

Reward Dice configurations are never shared by reference between Workflows.

---

# Future Extensibility

The model is intentionally designed to support future features without structural changes.

Examples:

- Marketplace
- Cloud Sync
- Analytics
- Community Workflows
- AI-generated Workflows
- Plugins
- Additional Asset Sources

These features extend the model.

They should not require redesigning it.

---

# Summary

The domain model intentionally separates long-lived business entities from lightweight configuration objects.

Entities define identity and lifecycle.

Value Objects define behavior and configuration.

Workflow is the core business entity.

Session represents execution.

Workflow defines behavior.

Session executes behavior.

Value Objects describe behavior.

Entities provide identity and lifecycle.

The surrounding architecture exists to support this domain model.
