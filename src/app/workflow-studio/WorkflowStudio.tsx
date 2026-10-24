import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import {
  type Asset,
  type AssetId,
  type AssetKind,
  type AssetRetirementChoice,
  type AssetRetirementPreview,
  type ImportAssetInput,
  type AssetRoleChangePreview,
} from '@/features/assets';
import { AssetLibrary } from '@/features/assets/studio';
import type { Settings } from '@/features/settings';
import { SettingsPage } from '@/features/settings/studio';
import { Button, Dialog } from '@/shared';
import type { DocumentPreferences } from '@/app/document-preferences/DocumentPreferences';
import { useDocumentPreferences } from '@/app/document-preferences/useDocumentPreferences';
import {
  useSidePanelControl,
  type SidePanelControlDependencies,
} from '@/app/useSidePanelControl';
import {
  createWorkflowId,
  type CreateWorkflowInput,
  type Workflow,
  type WorkflowId,
} from '@/features/workflow';
import {
  QuickWorkflowEditor,
  WorkflowEditor,
  WorkflowLibrary,
} from '@/features/workflow/studio';

import { WorkflowStudioShell } from './WorkflowStudioShell';
import type { WorkflowStudioNavigationOrientation } from './WorkflowStudioShell';

export type WorkflowStudioSnapshot = Readonly<{
  workflows: readonly Workflow[];
  assets: readonly Asset[];
  settings: Settings;
}>;

export type WorkflowStudioDependencies = Readonly<{
  preferences: DocumentPreferences;
  load(): Promise<WorkflowStudioSnapshot>;
  saveWorkflow(input: CreateWorkflowInput): Promise<void>;
  duplicateWorkflow(id: WorkflowId): Promise<void>;
  deleteWorkflow(id: WorkflowId): Promise<void>;
  reorderWorkflows(ids: readonly WorkflowId[]): Promise<void>;
  importAsset(file: File, kind: AssetKind): Promise<Asset>;
  synchronizeAssetImport(): Promise<void>;
  inspectAssetRetirement(id: AssetId): Promise<AssetRetirementPreview>;
  retireAsset(
    preview: AssetRetirementPreview,
    choice: AssetRetirementChoice,
  ): Promise<void>;
  synchronizeAssetRetirement(): Promise<void>;
  createAssetRetirementUploadInput(
    file: File,
    kind: AssetKind,
  ): ImportAssetInput;
  inspectAssetRoleChange(
    id: AssetId,
    value: string,
  ): Promise<AssetRoleChangePreview>;
  applyAssetRoleChange(preview: AssetRoleChangePreview): Promise<void>;
  synchronizeAssetRoleChange(): Promise<void>;
  loadAssetBlob: (id: AssetId) => Promise<Blob | null>;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  updateSettings(settings: Settings): Promise<void>;
  exportSettings(): Promise<void>;
  importSettings(file: File): Promise<void>;
  exportWorkflow(id: WorkflowId | undefined): Promise<void>;
  importWorkflow(file: File): Promise<void>;
  createId(): string;
}> &
  SidePanelControlDependencies;

type Tab = 'workflows' | 'assets' | 'settings';
const tabs: readonly Tab[] = ['workflows', 'assets', 'settings'];

function tabLabel(tab: Tab): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

export function WorkflowStudio({
  dependencies,
}: Readonly<{ dependencies: WorkflowStudioDependencies }>) {
  const documentPreferences = useDocumentPreferences(dependencies.preferences);
  const sidePanel = useSidePanelControl(dependencies);
  const [snapshot, setSnapshot] = useState<WorkflowStudioSnapshot | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<
    WorkflowId | undefined
  >();
  const [newWorkflowId, setNewWorkflowId] = useState<string | null>(null);
  const [newWorkflowMode, setNewWorkflowMode] =
    useState<Workflow['mode']>('detailed');
  const [quickDirty, setQuickDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [activeTab, setActiveTab] = useState<Tab>('workflows');
  const [error, setError] = useState<string | null>(null);
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());

  async function load(
    preferredId?: WorkflowId,
  ): Promise<WorkflowStudioSnapshot> {
    const loaded = await dependencies.load();
    setSnapshot(loaded);
    const selected =
      preferredId ??
      loaded.settings.lastSelectedWorkflowId ??
      loaded.workflows[0]?.id;
    setSelectedWorkflowId(
      selected !== undefined &&
        loaded.workflows.some(({ id }) => id === selected)
        ? selected
        : loaded.workflows[0]?.id,
    );
    return loaded;
  }

  async function reloadSnapshot(): Promise<void> {
    setSnapshot(await dependencies.load());
  }

  useEffect(() => {
    let active = true;
    void dependencies.load().then(
      (loaded) => {
        if (!active) return;
        setSnapshot(loaded);
        const preferred = loaded.settings.lastSelectedWorkflowId;
        setSelectedWorkflowId(
          preferred !== undefined &&
            loaded.workflows.some(({ id }) => id === preferred)
            ? preferred
            : loaded.workflows[0]?.id,
        );
      },
      (cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Loading failed.');
        }
      },
    );
    return () => {
      active = false;
    };
  }, [dependencies]);

  useEffect(() => {
    if (!quickDirty) return undefined;
    const preventExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventExit);
    return () => {
      window.removeEventListener('beforeunload', preventExit);
    };
  }, [quickDirty]);

  function navigate(action: () => void): void {
    if (quickDirty) {
      setPendingNavigation(() => action);
      return;
    }
    action();
  }

  function selectTab(tab: Tab): void {
    navigate(() => {
      setQuickDirty(false);
      setActiveTab(tab);
      queueMicrotask(() => tabRefs.current.get(tab)?.focus());
    });
  }

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    orientation: WorkflowStudioNavigationOrientation,
  ): void {
    const current = tabs.indexOf(activeTab);
    let next: number | null = null;
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const previousKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    if (event.key === nextKey) next = (current + 1) % tabs.length;
    if (event.key === previousKey)
      next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    const tab = tabs[next];
    if (tab !== undefined) selectTab(tab);
  }

  if (error !== null) {
    return (
      <p className="app-message feedback feedback--error" role="alert">
        {error}
      </p>
    );
  }
  if (snapshot === null) {
    return (
      <p className="app-message" role="status">
        Loading Locusora…
      </p>
    );
  }

  const selectedWorkflow = snapshot.workflows.find(
    ({ id }) => id === selectedWorkflowId,
  );
  const sidePanelLabel = sidePanel.isOpen
    ? 'Close side panel'
    : 'Open side panel';

  return (
    <WorkflowStudioShell
      topBar={
        <>
          <div className="app-header__identity">
            <img
              className="brand-logo"
              src="/brand/locusora-mark.svg"
              alt=""
              aria-hidden="true"
            />
            <div>
              <h1>Locusora</h1>
              <p>
                Design the rhythms and environments that help you return to
                focus.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            pending={sidePanel.pending}
            pendingLabel={sidePanelLabel}
            onClick={() => {
              void sidePanel.toggle();
            }}
          >
            {sidePanelLabel}
          </Button>
        </>
      }
      navigation={(orientation) => (
        <div
          className="tabs workflow-studio-shell__tabs"
          role="tablist"
          aria-label="Configuration"
          aria-orientation={orientation}
        >
          {tabs.map((tab) => {
            const label = tabLabel(tab);
            return (
              <button
                key={tab}
                ref={(node) => {
                  if (node === null) tabRefs.current.delete(tab);
                  else tabRefs.current.set(tab, node);
                }}
                id={`tab-${tab}`}
                className="tab"
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`panel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => {
                  selectTab(tab);
                }}
                onKeyDown={(event) => {
                  handleTabKey(event, orientation);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    >
      {sidePanel.error === null ? null : (
        <p className="feedback feedback--error" role="alert">
          {sidePanel.error}
        </p>
      )}
      <section
        className="tab-panel"
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'workflows' ? (
          <div className="workflow-workspace">
            <aside className="workflow-workspace__library">
              <WorkflowLibrary
                workflows={snapshot.workflows}
                {...(selectedWorkflowId === undefined
                  ? {}
                  : { selectedWorkflowId })}
                onCreate={(mode) => {
                  navigate(() => {
                    setQuickDirty(false);
                    setNewWorkflowId(dependencies.createId());
                    setNewWorkflowMode(mode);
                    setSelectedWorkflowId(undefined);
                  });
                  return Promise.resolve();
                }}
                onOpen={(id) => {
                  navigate(() => {
                    setQuickDirty(false);
                    setNewWorkflowId(null);
                    setSelectedWorkflowId(id);
                  });
                }}
                onDuplicate={async (id) => {
                  await dependencies.duplicateWorkflow(id);
                  await load(id);
                }}
                onDelete={async (id) => {
                  await dependencies.deleteWorkflow(id);
                  setNewWorkflowId(null);
                  await load();
                }}
                onReorder={async (ids) => {
                  await dependencies.reorderWorkflows(ids);
                  await load(selectedWorkflowId);
                }}
              />
            </aside>
            <div className="workflow-workspace__editor">
              {selectedWorkflow === undefined && newWorkflowId === null ? (
                <div className="workspace-prompt">
                  <h2>Select or create a Workflow.</h2>
                  <p>The editor will open here without leaving this page.</p>
                </div>
              ) : selectedWorkflow?.mode === 'quick' ||
                (selectedWorkflow === undefined &&
                  newWorkflowMode === 'quick') ? (
                <QuickWorkflowEditor
                  key={selectedWorkflow?.id ?? newWorkflowId}
                  workflowId={
                    selectedWorkflow?.id ??
                    newWorkflowId ??
                    dependencies.createId()
                  }
                  assets={snapshot.assets}
                  {...(selectedWorkflow?.mode === 'quick'
                    ? { workflow: selectedWorkflow }
                    : {})}
                  onDirtyChange={setQuickDirty}
                  onUploadAsset={async (file, kind) => {
                    const asset = await dependencies.importAsset(file, kind);
                    setSnapshot((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            assets: [
                              ...current.assets.filter(
                                ({ id }) => id !== asset.id,
                              ),
                              asset,
                            ],
                          },
                    );
                    return asset;
                  }}
                  onSynchronizeAssetUpload={async () => {
                    await dependencies.synchronizeAssetImport();
                    await reloadSnapshot();
                  }}
                  onSave={async (input) => {
                    await dependencies.saveWorkflow(input);
                    const id = createWorkflowId(input.id);
                    if (newWorkflowId !== null) {
                      const loaded = await dependencies.load();
                      const ids = loaded.workflows.map(
                        ({ id: value }) => value,
                      );
                      const currentIndex = ids.indexOf(id);
                      const firstModeIndex = loaded.workflows.findIndex(
                        (workflow) =>
                          workflow.id !== id && workflow.mode === input.mode,
                      );
                      if (
                        currentIndex >= 0 &&
                        firstModeIndex >= 0 &&
                        currentIndex !== firstModeIndex
                      ) {
                        ids.splice(currentIndex, 1);
                        ids.splice(firstModeIndex, 0, id);
                        await dependencies.reorderWorkflows(ids);
                      }
                    }
                    await load(id);
                    setNewWorkflowId(null);
                  }}
                />
              ) : (
                <WorkflowEditor
                  key={selectedWorkflow?.id ?? newWorkflowId}
                  workflowId={
                    selectedWorkflow?.id ??
                    newWorkflowId ??
                    dependencies.createId()
                  }
                  assets={snapshot.assets}
                  onUploadAsset={async (file, kind) => {
                    const asset = await dependencies.importAsset(file, kind);
                    setSnapshot((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            assets: [
                              ...current.assets.filter(
                                ({ id }) => id !== asset.id,
                              ),
                              asset,
                            ],
                          },
                    );
                    return asset;
                  }}
                  onSynchronizeAssetUpload={async () => {
                    await dependencies.synchronizeAssetImport();
                    await reloadSnapshot();
                  }}
                  {...(selectedWorkflow === undefined
                    ? {}
                    : { workflow: selectedWorkflow })}
                  onSave={async (input) => {
                    await dependencies.saveWorkflow(input);
                    const id = createWorkflowId(input.id);
                    if (newWorkflowId !== null) {
                      const loaded = await dependencies.load();
                      const ids = loaded.workflows.map(
                        ({ id: value }) => value,
                      );
                      const currentIndex = ids.indexOf(id);
                      const firstModeIndex = loaded.workflows.findIndex(
                        (workflow) =>
                          workflow.id !== id && workflow.mode === 'detailed',
                      );
                      if (
                        currentIndex >= 0 &&
                        firstModeIndex >= 0 &&
                        currentIndex !== firstModeIndex
                      ) {
                        ids.splice(currentIndex, 1);
                        ids.splice(firstModeIndex, 0, id);
                        await dependencies.reorderWorkflows(ids);
                      }
                    }
                    await load(id);
                    setNewWorkflowId(null);
                  }}
                />
              )}
            </div>
          </div>
        ) : activeTab === 'assets' ? (
          <AssetLibrary
            assets={snapshot.assets}
            onImport={async (file, kind) => {
              await dependencies.importAsset(file, kind);
              await load(selectedWorkflowId);
            }}
            onInspectRetirement={(id) =>
              dependencies.inspectAssetRetirement(id)
            }
            onRetire={async (preview, choice) => {
              await dependencies.retireAsset(preview, choice);
            }}
            onSynchronizeRetirement={async () => {
              await dependencies.synchronizeAssetRetirement();
              await load(selectedWorkflowId);
            }}
            createRetirementUploadInput={(file, kind) =>
              dependencies.createAssetRetirementUploadInput(file, kind)
            }
            onInspectRoleChange={(id, value) =>
              dependencies.inspectAssetRoleChange(id, value)
            }
            onApplyRoleChange={async (preview) => {
              await dependencies.applyAssetRoleChange(preview);
              await load(selectedWorkflowId);
            }}
            onSynchronizeRoleChange={async () => {
              await dependencies.synchronizeAssetRoleChange();
              await load(selectedWorkflowId);
            }}
            loadBlob={dependencies.loadAssetBlob}
            createObjectUrl={dependencies.createObjectUrl}
            revokeObjectUrl={dependencies.revokeObjectUrl}
          />
        ) : (
          <SettingsPage
            settings={{
              ...snapshot.settings,
              theme: documentPreferences.theme,
              reducedMotion: documentPreferences.reducedMotion,
              ambientVolumePercent: documentPreferences.ambientVolumePercent,
              ambientMuted: documentPreferences.ambientMuted,
              cueVolumePercent: documentPreferences.cueVolumePercent,
              cuesMuted: documentPreferences.cuesMuted,
              muteCuesWithMusic: documentPreferences.muteCuesWithMusic,
              backgroundBlurPx: documentPreferences.backgroundBlurPx,
              backgroundBrightnessPercent:
                documentPreferences.backgroundBrightnessPercent,
            }}
            onUpdate={async (settings) => {
              await dependencies.updateSettings(settings);
              await load(selectedWorkflowId);
            }}
            onExportSettings={() => dependencies.exportSettings()}
            onImportSettings={async (file) => {
              await dependencies.importSettings(file);
              await load(selectedWorkflowId);
            }}
            onExportWorkflow={() =>
              dependencies.exportWorkflow(selectedWorkflowId)
            }
            onImportWorkflow={async (file) => {
              await dependencies.importWorkflow(file);
              await load();
            }}
          />
        )}
      </section>
      <Dialog
        open={pendingNavigation !== null}
        title="Discard changes?"
        onCancel={() => {
          setPendingNavigation(null);
        }}
      >
        <p>Your unsaved Quick Workflow changes will be lost.</p>
        <div className="dialog__actions">
          <Button
            variant="secondary"
            onClick={() => {
              setPendingNavigation(null);
            }}
          >
            Stay
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const action = pendingNavigation;
              setPendingNavigation(null);
              setQuickDirty(false);
              action?.();
            }}
          >
            Discard changes
          </Button>
        </div>
      </Dialog>
    </WorkflowStudioShell>
  );
}
