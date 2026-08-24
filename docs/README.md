# Flowarium Documentation

This directory is the entry point for product, architecture and developer
documentation.

## Reading Paths

### Understand the product and its rules

Read [`concepts/`](concepts/) in numerical order. These documents define the
product scope, Domain language, architecture, code organization, engineering
standards and testing policy.

### Understand architectural decisions

Use the [ADR index](adr/README.md) to find the reasoning, alternatives and
consequences behind accepted long-lived decisions.

### Work on the implementation

Start with [Getting Started](onboarding/01_GETTING_STARTED.md) to install, build,
load and verify the extension. Continue with the
[System Tour](onboarding/02_SYSTEM_TOUR.md), then read the
[Runtime Model](onboarding/03_RUNTIME_MODEL.md). Use the
[Project Map](development/PROJECT_MAP.md) to locate ownership, the
[Runtime and Navigation reference](development/RUNTIME_AND_NAVIGATION.md) for
extension surfaces, and
[Architecture Boundaries](development/ARCHITECTURE_BOUNDARIES.md) before adding
dependencies. For cross-context behavior, continue with
[State and Data Flow](development/STATE_AND_DATA_FLOW.md) and the complete
[Runtime Messaging catalog](development/MESSAGING.md). Use
[Persistence and Compatibility](development/PERSISTENCE.md) before changing
records, schemas or import/export behavior. Feature internals are documented in
the [Workflow reference](development/features/WORKFLOW.md) and
[Session reference](development/features/SESSION.md). The remaining reference
is being added incrementally; until a specific guide is present, read the
relevant Concept documents and ADRs before changing its source owner.

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
