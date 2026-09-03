# Import and Export Flow

## Trigger

The user selects one of four Options actions: export/import the selected
Workflow package, or export/import the application Settings package.

These are two independent public envelopes. A Workflow package is not a Settings
backup, and a Settings package never contains Workflows or Assets.

## Preconditions

- Workflow export has a selected, existing Workflow.
- Referenced Workflow Assets have both valid metadata and Blob content.
- Import receives UTF-8 JSON within the composition-supplied limit.
- Workflow import receives an Asset MIME/size policy and collision-safe identity
  generators.

Current Options limits are 100 MiB per Workflow package and 1 MiB per Settings
package. Embedded Asset limits remain 10 MiB image / 50 MiB audio with the
configured MIME allowlists.

## Sequence

### Workflow Export

1. Options resolves the selected Workflow from the repository.
2. [`exportWorkflowUseCase()`](../../../src/features/workflow/application/exportWorkflowUseCase.ts)
   collects distinct background/audio Asset IDs and sorts them lexically.
3. For each ID it requires matching Asset metadata and Blob content, reads the
   bytes and Base64-encodes them.
4. [`serializeWorkflow()`](../../../src/features/workflow/application/workflowPackageMapping.ts)
   creates the public Workflow shape, preserving Phase/side order and emitting
   current Reward trigger/reroll fields.
5. The use case serializes `{ kind: 'locusora/workflow', version: 1, workflow,
assets }`. Sorted Assets and stable property/array order make repeated export
   deterministic for unchanged input.
6. Options creates a temporary JSON Blob/object URL, clicks a download link and
   revokes the URL.

### Workflow Import

1. [`importWorkflowUseCase()`](../../../src/features/workflow/application/importWorkflowUseCase.ts)
   checks UTF-8 byte size before parsing JSON as `unknown`.
2. It requires the exact four-field envelope, kind `locusora/workflow`, version
   1 and an Asset array.
3. `parseWorkflow()` validates exact nested keys and reconstructs a trusted
   Workflow through `createWorkflow()`; accepted legacy package omissions for
   Reward trigger/rerolls receive Domain defaults.
4. Each embedded Asset requires six exact fields. Base64 must decode, decoded
   length must equal `byteSize`, kind must be `image | audio`, and
   `validateAssetImport()` must accept its content/MIME/size.
5. Source Asset IDs must be unique. The set must agree exactly with Workflow
   Environment references, including image for background and audio for audio.
   Missing, extra or wrong-kind Assets reject the complete package.
6. New Asset IDs are generated without collision against existing or earlier
   imported IDs. A new Workflow ID is generated without collision against the
   current catalog.
7. Every Environment reference is rewritten from the package ID to its new local
   Asset ID. The imported Workflow is rebuilt through `createWorkflow()`.
8. Only after all validation/reads/rewriting succeed,
   [`DexieWorkflowPackageUnitOfWork`](../../../src/features/workflow/infrastructure/DexieWorkflowPackageUnitOfWork.ts)
   writes all Assets and the Workflow in one `workflows + assets` transaction.
9. Options wraps this mutation with catalog invalidation and reloads its local
   snapshot.

### Settings Export and Import

1. [`exportSettingsUseCase()`](../../../src/features/settings/application/exportSettingsUseCase.ts)
   loads validated settings or defaults and serializes
   `{ kind: 'locusora/settings', version: 1, settings }`.
2. Export uses the same temporary browser download mechanism but a distinct file
   name.
3. [`importSettingsUseCase()`](../../../src/features/settings/application/importSettingsUseCase.ts)
   checks UTF-8 size, parses `unknown`, requires exactly the three envelope keys
   with kind/version 1 and validates Settings through `createSettings()`.
4. Only then does it perform one `chrome.storage.local.set`; Options reloads and
   reapplies document theme/motion.

## Authoritative Changes

- Export changes no persistent state.
- Workflow import creates new Workflow/Asset identities; it never overwrites the
  source IDs or existing local records intentionally.
- Settings import replaces the single stored Settings value.
- Import/export packages contain public Domain transport data, not Dexie order,
  record schema versions, Session state or Chrome Storage envelopes.

## Messages

Successful Workflow import publishes the payload-free
`workflow/catalog-changed` event after the transaction. Settings import publishes
no runtime message; Options reloads its own snapshot. No package bytes travel
through Chrome runtime messaging.

## Persistence

Workflow import is atomic across IndexedDB `workflows` and `assets`. A thrown
write rolls back both tables. Settings import is a separate single Chrome
Storage write and cannot participate in that Dexie transaction. The UI must not
present a combined cross-storage atomic backup.

## Failure and Recovery

| Failure                                                               | Observable result                                         | Recovery                                             |
| --------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| File exceeds limit or JSON/envelope is invalid                        | Import rejects before writes                              | Choose/fix a supported package                       |
| Workflow/Asset shape, Base64, size, MIME or reference agreement fails | Entire Workflow import rejects                            | Correct the source package; no partial Assets remain |
| Unique ID generation fails after 100 attempts                         | Workflow import rejects before transaction                | Fix the injected identity source                     |
| Transaction write fails                                               | Both Workflow and Asset writes roll back                  | Diagnose IndexedDB/quota failure and retry           |
| Settings storage write fails                                          | Existing Settings remain authoritative                    | Diagnose Chrome Storage and retry                    |
| Referenced Asset missing during export                                | Export rejects; no download is produced                   | Restore or remove the invalid Workflow reference     |
| Catalog event fails after successful Workflow import                  | Imported data is already durable, but caller sees failure | Reload documents/catalog from IndexedDB              |

## Proof in Tests

- Workflow round-trip, deterministic order, identity/reference rewrite and
  zero-write validation failures:
  `src/features/workflow/application/workflowPackage.test.ts`.
- multi-table rollback:
  `src/features/workflow/infrastructure/DexieWorkflowPackageUnitOfWork.test.ts`.
- Settings package/default/no-write behavior:
  `src/features/settings/application/settingsUseCases.test.ts`.
- Options operation feedback/composition:
  `src/features/settings/presentation/SettingsPage.test.tsx` and
  `src/app/options/OptionsApp.test.tsx`.
- assembled file journeys: `tests/e2e/dataPortability.spec.ts`.

Run focused proof with:

```bash
pnpm vitest run src/features/workflow src/features/settings src/app/options
```

## Related Concepts and ADRs

- [Product Specification](../../concepts/01_PRODUCT_SPECIFICATION.md)
- [ADR-0005: Local-First Persistence](../../adr/ADR-0005-local-first-persistence.md)
- [ADR-0006: Local Asset Lifecycle](../../adr/ADR-0006-local-asset-lifecycle.md)
- [ADR-0007: Versioned Import and Export](../../adr/ADR-0007-versioned-import-export.md)
- [Persistence and Compatibility](../PERSISTENCE.md)
- [Assets Feature](../features/ASSETS.md)
- [Settings Feature](../features/SETTINGS.md)
