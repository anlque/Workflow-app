import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import {
  AssetLibrary,
  type Asset,
  type AssetId,
  type AssetKind,
} from '@/features/assets';
import { SettingsPage, type Settings } from '@/features/settings';
import {
  createWorkflowId,
  WorkflowEditor,
  WorkflowLibrary,
  type CreateWorkflowInput,
  type Workflow,
  type WorkflowId,
} from '@/features/workflow';

type OptionsSnapshot = Readonly<{
  workflows: readonly Workflow[];
  assets: readonly Asset[];
  settings: Settings;
}>;

export type OptionsDependencies = {
  load(): Promise<OptionsSnapshot>;
  saveWorkflow(input: CreateWorkflowInput): Promise<void>;
  duplicateWorkflow(id: WorkflowId): Promise<void>;
  deleteWorkflow(id: WorkflowId): Promise<void>;
  reorderWorkflows(ids: readonly WorkflowId[]): Promise<void>;
  importAsset(file: File, kind: AssetKind): Promise<void>;
  deleteAsset(id: AssetId): Promise<void>;
  loadAssetBlob(id: AssetId): Promise<Blob | null>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  updateSettings(settings: Settings): Promise<void>;
  exportSettings(): Promise<void>;
  importSettings(file: File): Promise<void>;
  exportWorkflow(id: WorkflowId | undefined): Promise<void>;
  importWorkflow(file: File): Promise<void>;
  createId(): string;
};

type Tab = 'workflows' | 'assets' | 'settings';
const tabs: readonly Tab[] = ['workflows', 'assets', 'settings'];

function tabLabel(tab: Tab): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

export function OptionsApp({
  dependencies,
}: Readonly<{ dependencies: OptionsDependencies }>) {
  const [snapshot, setSnapshot] = useState<OptionsSnapshot | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<
    WorkflowId | undefined
  >();
  const [newWorkflowId, setNewWorkflowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('workflows');
  const [error, setError] = useState<string | null>(null);
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());

  async function load(preferredId?: WorkflowId): Promise<void> {
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
    if (snapshot === null) return;
    document.documentElement.dataset['theme'] = snapshot.settings.theme;
    document.documentElement.dataset['reducedMotion'] =
      snapshot.settings.reducedMotion;
  }, [snapshot]);

  function selectTab(tab: Tab): void {
    setActiveTab(tab);
    queueMicrotask(() => tabRefs.current.get(tab)?.focus());
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>): void {
    const current = tabs.indexOf(activeTab);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (event.key === 'ArrowLeft')
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
        Loading Flowarium…
      </p>
    );
  }

  const selectedWorkflow = snapshot.workflows.find(
    ({ id }) => id === selectedWorkflowId,
  );

  return (
    <main className="options-app">
      <header className="app-header">
        <div>
          <h1>Flowarium</h1>
          <p>
            Design the rhythms and environments that help you return to focus.
          </p>
        </div>
      </header>
      <div className="tabs" role="tablist" aria-label="Configuration">
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
                setActiveTab(tab);
              }}
              onKeyDown={handleTabKey}
            >
              {label}
            </button>
          );
        })}
      </div>

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
                onCreate={() => {
                  setNewWorkflowId(dependencies.createId());
                  setSelectedWorkflowId(undefined);
                  return Promise.resolve();
                }}
                onOpen={(id) => {
                  setNewWorkflowId(null);
                  setSelectedWorkflowId(id);
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
              ) : (
                <WorkflowEditor
                  key={selectedWorkflow?.id ?? newWorkflowId}
                  workflowId={
                    selectedWorkflow?.id ??
                    newWorkflowId ??
                    dependencies.createId()
                  }
                  assets={snapshot.assets}
                  {...(selectedWorkflow === undefined
                    ? {}
                    : { workflow: selectedWorkflow })}
                  onSave={async (input) => {
                    await dependencies.saveWorkflow(input);
                    const id = createWorkflowId(input.id);
                    setNewWorkflowId(null);
                    await load(id);
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
            onDelete={async (id) => {
              await dependencies.deleteAsset(id);
              await load(selectedWorkflowId);
            }}
            loadBlob={(id) => dependencies.loadAssetBlob(id)}
            createObjectUrl={(blob) => dependencies.createObjectUrl(blob)}
            revokeObjectUrl={(url) => {
              dependencies.revokeObjectUrl(url);
            }}
          />
        ) : (
          <SettingsPage
            settings={snapshot.settings}
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
    </main>
  );
}
