# Architecture

---

# Purpose

This document defines the architectural principles of the project.

It describes how the codebase is organized, how modules interact, and which dependency rules must always be respected.

Architecture exists to protect the domain model from implementation details.

---

# Architectural Goals

The architecture should provide:

- simplicity;
- maintainability;
- scalability;
- testability;
- extensibility;
- low coupling;
- high cohesion.

---

# Guiding Principles

The following principles guide every architectural decision.

## Domain First

The domain model is the center of the application.

All other layers exist to support it.

---

## Framework Independence

Business logic must not depend on React, Chrome APIs, Zustand or any other framework.

Frameworks may change.

The domain should not.

---

## Feature First

The application is organized around business capabilities rather than technical layers.

Examples:

- Workflow
- Session
- Assets
- Reward Dice

instead of

- Components
- Hooks
- Utils
- Services

---

## Composition over Coupling

Modules communicate through explicit interfaces.

Hidden dependencies are not allowed.

---

## Infrastructure is Replaceable

Storage providers, browser APIs and third-party services are implementation details.

They must be replaceable without changing the domain.

---

## Explicit Dependencies

Every dependency should point toward more stable layers.

Dependencies must never point in the opposite direction.

---

# Architectural Style

The project follows a Feature-First architecture with a clean separation between:

- Domain
- Application
- Infrastructure
- Presentation

The architecture is inspired by:

- Domain-Driven Design (DDD)
- Clean Architecture
- Vertical Slice Architecture

without following any of them dogmatically.

---

# Layers

## Domain

Contains business entities, value objects and business rules.

Never depends on other layers.

---

## Application

Coordinates business use cases.

Contains orchestration logic.

Depends only on Domain.

---

## Infrastructure

Contains external integrations.

Examples:

- IndexedDB
- Chrome Storage
- Chrome APIs
- Unsplash
- Spotify

Implements ports defined by the Application layer.

---

## Presentation

Contains UI.

Examples:

- React components
- Pages
- Hooks
- UI state

Depends on Application.

Never directly accesses Infrastructure.

---

# Dependency Rules

The following dependency graph must always remain valid.

```text
Presentation

↓

Application

↓

Domain

Application ports ← Infrastructure adapters
```

Application owns the ports required by its use cases. Infrastructure implements
those ports. The `app` composition root injects concrete adapters into
Application use cases.

The Domain layer must never know about Infrastructure.

---

# Module Boundaries

Every business capability is implemented as an independent feature module.

Modules should minimize knowledge about each other.

Cross-feature communication must happen through explicit public APIs.

---

# Data Flow

User Action

↓

Presentation

↓

Application

├── invokes Domain behavior
│
└── calls an Application port
            ↑
    Infrastructure adapter
            ↓
       External system

↓

Presentation Update

Control follows use cases and explicit ports. Source-code dependencies continue
to point inward even when runtime calls cross an Infrastructure adapter.

---

# State Management

Domain state and invariants belong to Domain objects. Application owns use-case
coordination and the lifecycle of active operations.

UI state belongs to Presentation.

Persistent state belongs to Infrastructure.

Each layer owns only its own state.

The authoritative active Session is coordinated by the background service
worker through Application use cases. Extension surfaces hold presentation
projections only and synchronize through typed messages and persisted state.

---

# Persistence

Persistence is an implementation detail.

Business objects must never know:

- where data is stored;
- how data is serialized;
- which storage engine is used.

---

# Extension Strategy

New functionality should be added by introducing new feature modules.

Existing modules should rarely require modification.

The architecture follows the Open/Closed Principle whenever practical.

---

# Error Handling

Errors should be handled at the appropriate layer.

Domain validates business rules.

Infrastructure handles technical failures.

Presentation communicates errors to users.

---

# Testing Strategy

The testing pyramid mirrors the architecture.

- Domain → unit tests
- Application → integration tests
- Presentation → component tests
- End-to-end → user flows

---

# Accepted ADRs

Accepted architectural decisions are indexed in
[`docs/adr/README.md`](../adr/README.md). This document defines the current
architecture; ADRs preserve the reasoning and consequences behind individual
long-lived decisions.
