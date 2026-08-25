# Settings Feature

## Purpose

The Settings feature owns the small, local application preference value and its
separate import/export package. Current settings are theme, reduced-motion
preference and the optional last-selected Workflow identifier.

Source root: [`src/features/settings/`](../../../src/features/settings/).

## Owns

- the validated immutable Settings value and defaults;
- Settings repository and use-case contracts;
- the `flowarium/settings` version-1 package parser and import/export;
- the `chrome.storage.local` adapter under the `settings` key;
- the Options Settings presentation and operation feedback;
- the root public API in
  [`index.ts`](../../../src/features/settings/index.ts).

## Does Not Own

- Workflow data or Workflow package import/export;
- how extension surfaces apply theme and motion to the document;
- Options tab navigation or file-download mechanics;
- browser-account synchronization or cloud persistence;
- language selection or onboarding state.

Language, onboarding state and browser synchronization are future scope. They
must not be presented as current fields or silently added to stored input.

## Public API

Consumers import only from `@/features/settings`.

| Group                      | Exports                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Domain                     | `Settings`, `Theme`, `ReducedMotion`, `createSettings`, `defaultSettings`, `SettingsValidationError`                    |
| Application contracts      | `SettingsRepository`, `SettingsPackageV1`, `SettingsImportLimits`, `SettingsPackageValidationError`                     |
| Application behavior       | `getSettingsUseCase`, `updateSettingsUseCase`, `exportSettingsUseCase`, `importSettingsUseCase`, `parseSettingsPackage` |
| Infrastructure composition | `ChromeSettingsRepository`, `SettingsStorageArea`                                                                       |
| Presentation               | `SettingsPage`, `SettingsPageProps`                                                                                     |

Infrastructure is public only so `src/app` can compose a concrete adapter.
Presentation never imports it directly.

## Internal Layers

### Domain

[`domain/Settings.ts`](../../../src/features/settings/domain/Settings.ts)
defines the complete Settings value, strict runtime constructor and defaults.
It uses the Workflow root API only to validate the optional Workflow identity.

### Application

[`application/`](../../../src/features/settings/application/) defines the
storage port, load/update use cases and the independent versioned package.
Raw storage and parsed JSON enter as `unknown` and cross the Domain constructor.

### Infrastructure

[`ChromeSettingsRepository.ts`](../../../src/features/settings/infrastructure/ChromeSettingsRepository.ts)
maps one logical Settings value to `chrome.storage.local`. It intentionally
does not cast reads into Domain types.

### Presentation

[`SettingsPage.tsx`](../../../src/features/settings/presentation/SettingsPage.tsx)
renders appearance controls and separate Workflow/Settings portability actions.
All I/O is injected by Options.

## Domain Invariants

- `theme` is exactly `system`, `light` or `dark`.
- `reducedMotion` is exactly `system`, `reduce` or `no-preference`.
- `lastSelectedWorkflowId`, when present, is a non-empty branded Workflow ID.
- The input must be a plain object with no keys beyond those three fields.
- The returned Settings object is frozen.
- Missing persisted settings resolve to frozen defaults: system theme and
  system motion preference.
- Invalid persisted settings fail validation; they do not silently fall back to
  defaults.

`lastSelectedWorkflowId` is navigation preference, not a foreign-key guarantee.
Options checks whether it still exists and falls back to the first Workflow.

## Use Cases

| Use case                | Inputs                            | Behavior                                                                                    | Result/failure                                     |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `getSettingsUseCase`    | Repository                        | Loads `unknown`; returns defaults only when absent, otherwise validates                     | Trusted Settings or validation/storage failure     |
| `updateSettingsUseCase` | Repository and `unknown` input    | Validates first, then saves                                                                 | Updated Settings; no write on invalid input        |
| `exportSettingsUseCase` | Repository                        | Loads validated/default settings and serializes a version-1 envelope                        | Deterministic compact JSON                         |
| `importSettingsUseCase` | Repository, JSON text, byte limit | Checks UTF-8 size, parses `unknown`, validates exact envelope and Settings, then saves      | Imported Settings; no write on validation failure  |
| `parseSettingsPackage`  | `unknown` value                   | Requires exactly `kind`, `version`, `settings` with kind `flowarium/settings` and version 1 | Frozen package or `SettingsPackageValidationError` |

The Options composition currently limits a Settings package to 1 MiB and owns
file reading/download. Side panel writes `lastSelectedWorkflowId` before opening
Options for a chosen Workflow.

## Persistence

`ChromeSettingsRepository` reads and writes one `settings` key in
`chrome.storage.local`. There is no Dexie table, database migration or record
`schemaVersion` for Settings. The public package `version: 1` belongs only to
the import/export envelope.

Chrome Storage cannot share a transaction with IndexedDB. The current Settings
package is deliberately independent, so its single `set` is the only import
write. See [Persistence and Compatibility](../PERSISTENCE.md) and
[ADR-0007](../../adr/ADR-0007-versioned-import-export.md).

## Presentation Consumers

Options loads Settings together with Workflows and Assets, then applies
`theme` and `reducedMotion` as root document data attributes. After an update or
import it reloads its snapshot so the controls and document state agree.

`SettingsPage` provides:

- theme and reduced-motion selects;
- separate Workflow package and Settings package actions;
- per-operation pending state;
- accessible success status or error alert feedback.

Workflow portability is displayed here for discoverability but remains owned by
the Workflow Application layer. The Settings feature does not combine the two
package contracts.

## Dependencies

- Domain imports Workflow only through `@/features/workflow` for Workflow ID
  construction.
- Application depends only on Settings Domain and its repository port.
- Infrastructure depends on the Application port and WXT's browser adapter.
- Presentation depends on Settings Domain, React and Shared UI.
- Options composes Chrome Storage, file I/O, document attributes and refresh.

## Failure Model

| Failure                                  | Owner              | Behavior                                               |
| ---------------------------------------- | ------------------ | ------------------------------------------------------ |
| Unknown field, enum or Workflow ID       | Domain             | Throws `SettingsValidationError`                       |
| Invalid/oversized JSON or wrong envelope | Application        | Throws `SettingsPackageValidationError` before a write |
| Invalid persisted value                  | Application/Domain | Load rejects; defaults apply only to absence           |
| Chrome Storage read/write failure        | Infrastructure     | Rejects to the caller                                  |
| UI operation failure                     | Presentation       | Keeps rendered Settings and shows an accessible error  |

## Tests

| Area                                                              | Primary proof                                     |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| Defaults, validation, deterministic package and no-write failures | `application/settingsUseCases.test.ts`            |
| Single Chrome Storage key mapping                                 | `infrastructure/ChromeSettingsRepository.test.ts` |
| Appearance updates, pending state and portability feedback        | `presentation/SettingsPage.test.tsx`              |
| Options composition and application of settings                   | `src/app/options/OptionsApp.test.tsx`             |
| Settings import/export journey                                    | `tests/e2e/dataPortability.spec.ts`               |

Run focused tests with:

```bash
pnpm vitest run src/features/settings
```

## Change Impact Checklist

1. Decide whether the field belongs to current Settings or future scope.
2. Update the Settings type, exact-key constructor and defaults together.
3. Decide explicit behavior for missing legacy values before writing new data.
4. Update the package parser/export and its compatibility tests.
5. Update Options load/apply behavior and `SettingsPage` controls.
6. Keep Settings and Workflow packages separate unless a new ADR changes the
   atomicity boundary.
7. Check every runtime surface that consumes document theme or motion.
8. Update Application, Infrastructure, component and relevant E2E tests.
