# Flowarium Documentation

This directory is the entry point for product, architecture and developer
documentation.

## Reading Paths

### Product and Engineering Rules

Concepts are normative and must be read in this numerical order before changing
their implementation:

1. [Project Manifesto](concepts/00_PROJECT_MANIFESTO.md)
2. [Product Specification](concepts/01_PRODUCT_SPECIFICATION.md)
3. [Domain Model](concepts/02_DOMAIN_MODEL.md)
4. [Architecture](concepts/03_ARCHITECTURE.md)
5. [Folder Structure](concepts/04_FOLDER_STRUCTURE.md)
6. [Design Principles](concepts/05_DESIGN_PRINCIPLES.md)
7. [Technology Stack](concepts/06_TECH_STACK.md)
8. [Coding Standards](concepts/07_CODING_STANDARDS.md)
9. [Testing Strategy](concepts/08_TESTING_STRATEGY.md)
10. [ADR Guidelines](concepts/09_ADR_GUIDELINES.md)

Use the [ADR index](adr/README.md) for accepted decisions, alternatives and
consequences behind the current architecture.

### New Contributor Onboarding

Follow these pages in order:

1. [Getting Started](onboarding/01_GETTING_STARTED.md) — install, build, load
   and verify the extension.
2. [System Tour](onboarding/02_SYSTEM_TOUR.md) — locate features, layers and
   composition roots.
3. [Runtime Model](onboarding/03_RUNTIME_MODEL.md) — understand independent MV3
   contexts, authority and navigation.
4. [First Change](onboarding/04_FIRST_CHANGE.md) — trace one persisted Workflow
   rule through every implementation boundary.

### Core Developer Reference

- [Project Map](development/PROJECT_MAP.md) — source ownership and entry points.
- [Runtime and Navigation](development/RUNTIME_AND_NAVIGATION.md) — extension
  surfaces, URLs and browser navigation.
- [Architecture Boundaries](development/ARCHITECTURE_BOUNDARIES.md) — allowed
  dependency direction and enforcement.
- [State and Data Flow](development/STATE_AND_DATA_FLOW.md) — authoritative,
  durable and projected state.
- [Runtime Messaging](development/MESSAGING.md) — exact cross-context contract
  catalog.
- [Persistence and Compatibility](development/PERSISTENCE.md) — schemas,
  records, packages, transactions and migrations.
- [Testing and Debugging](development/TESTING_AND_DEBUGGING.md) — commands,
  environments, fixture limits and incident playbooks.

### Feature Reference

- [Workflow](development/features/WORKFLOW.md)
- [Session](development/features/SESSION.md)
- [Assets](development/features/ASSETS.md)
- [Settings](development/features/SETTINGS.md)

### Cross-Cutting Flows

- [Start Session](development/flows/START_SESSION.md)
- [Phase Transition](development/flows/PHASE_TRANSITION.md)
- [Reward Dice](development/flows/REWARD_DICE.md)
- [Workflow Catalog Synchronization](development/flows/WORKFLOW_CATALOG_SYNC.md)
- [Import and Export](development/flows/IMPORT_EXPORT.md)

### Change Recipes

- [Add a Persisted Workflow Field](development/recipes/ADD_WORKFLOW_FIELD.md)
- [Add or Change a Runtime Message](development/recipes/ADD_RUNTIME_MESSAGE.md)
- [Change the IndexedDB Schema](development/recipes/CHANGE_DATABASE_SCHEMA.md)
- [Add an Extension Surface](development/recipes/ADD_EXTENSION_SURFACE.md)
- [Add or Select a Test](development/recipes/ADD_TEST.md)

## Source of Truth

Documentation authority is ordered as follows:

1. `docs/concepts/` defines normative product, Domain and engineering rules.
2. Accepted records in `docs/adr/` explain binding architectural decisions.
3. `docs/development/` describes how the current source implements those rules.
4. `docs/onboarding/` provides an ordered learning path through the same current
   implementation.
5. The root `README.md` remains a concise setup and project entry point.

If implementation and documentation disagree, do not silently document the
drift. Determine whether the implementation is wrong or whether a new
architectural decision supersedes an existing one, then update the appropriate
source of truth.

## Document Status

- Concepts and Accepted ADRs are normative.
- Developer reference describes current implementation and must change with it.
- Onboarding documents are explanatory and link to normative sources.
- Flows explain behavior that crosses several owners.
- Recipes are bounded change checklists, not architectural exceptions.

Agent-local planning artifacts may exist under the Git-ignored
`docs/superpowers/` directory. They are execution aids, not project
documentation or a source of truth.

## Maintenance Rule

Update developer documentation in the same change when modifying:

- a public feature API;
- an extension surface or navigation path;
- a runtime message;
- state ownership;
- a persistence record, schema version or compatibility default;
- a documented cross-cutting flow;
- required setup or verification commands.

Do not duplicate normative rules in onboarding or reference documents. Link to
the owning Concept or ADR and explain only how the current implementation
realizes it.
