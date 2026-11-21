import { useRef, useState, type ReactNode } from 'react';

import { Button, Dialog, Icon, Select } from '@/shared';

import type { Workflow, WorkflowId } from '../domain/Workflow';

type WorkflowSort = 'manual' | 'name-asc' | 'name-desc';

function formatWorkflowDuration(workflow: Workflow): string {
  const totalSeconds = workflow.phases.reduce(
    (total, phase) => total + phase.durationSeconds,
    0,
  );
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours > 0 ? `${String(hours)} hr` : undefined,
    minutes > 0 ? `${String(minutes)} min` : undefined,
    seconds > 0 || totalSeconds === 0 ? `${String(seconds)} sec` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(' ');
}

export type WorkflowLibraryProps = Readonly<{
  workflows: readonly Workflow[];
  selectedWorkflowId?: WorkflowId;
  busyWorkflowId?: WorkflowId;
  onCreate(mode: Workflow['mode']): Promise<void>;
  onOpen(id: WorkflowId): void;
  onDuplicate(id: WorkflowId): Promise<void>;
  onDelete(id: WorkflowId): Promise<void>;
  onReorder(ids: readonly WorkflowId[]): Promise<void>;
  onExport?(id: WorkflowId): Promise<void>;
  onImport?(file: File): Promise<void>;
  onStart?(id: WorkflowId): Promise<void>;
  renderThumbnail?(workflow: Workflow): ReactNode;
}>;

export function WorkflowLibrary({
  workflows,
  selectedWorkflowId,
  busyWorkflowId,
  onCreate,
  onOpen,
  onDuplicate,
  onDelete,
  onReorder,
  onExport,
  onImport,
  onStart,
  renderThumbnail,
}: WorkflowLibraryProps) {
  const [deleting, setDeleting] = useState<Workflow | null>(null);
  const [choosingMode, setChoosingMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [openActionsId, setOpenActionsId] = useState<WorkflowId | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<WorkflowSort>('manual');
  const [error, setError] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const overflowTriggers = useRef(new Map<WorkflowId, HTMLButtonElement>());

  async function perform(key: string, action: () => Promise<void>) {
    setError(null);
    setPendingAction(key);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action failed.');
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  function performOverflow(
    workflowId: WorkflowId,
    key: string,
    action: () => Promise<void>,
  ) {
    void perform(key, action).then((succeeded) => {
      if (!succeeded) return;
      setOpenActionsId(null);
      overflowTriggers.current.get(workflowId)?.focus();
    });
  }

  function reordered(workflow: Workflow, offset: -1 | 1) {
    const ids = workflows.map(({ id }) => id);
    const group = workflows.filter(({ mode }) => mode === workflow.mode);
    const groupIndex = group.findIndex(({ id }) => id === workflow.id);
    const destination = group[groupIndex + offset];
    if (destination === undefined) return ids;
    const currentIndex = ids.indexOf(workflow.id);
    const destinationIndex = ids.indexOf(destination.id);
    ids[currentIndex] = destination.id;
    ids[destinationIndex] = workflow.id;
    return ids;
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = (['quick', 'detailed'] as const).flatMap((mode) => {
    const values = workflows
      .filter(
        (workflow) =>
          workflow.mode === mode &&
          workflow.name.toLocaleLowerCase().includes(normalizedQuery),
      )
      .slice();
    if (sort !== 'manual') {
      values.sort((left, right) => {
        const result = left.name.localeCompare(right.name, undefined, {
          sensitivity: 'base',
        });
        return sort === 'name-asc' ? result : -result;
      });
    }
    return values.length === 0 ? [] : [{ mode, values }];
  });
  const renderedWorkflowCount = groups.reduce(
    (count, { values }) => count + values.length,
    0,
  );

  const createButton = (label: string) => (
    <Button
      variant="primary"
      onClick={() => {
        setChoosingMode(true);
      }}
    >
      <Icon name="addCircle" size={18} />
      {label}
    </Button>
  );
  const importControl =
    onImport === undefined ? null : (
      <>
        <Button
          variant="secondary"
          pending={pendingAction === 'import'}
          pendingLabel="Importing…"
          onClick={() => importInput.current?.click()}
        >
          <Icon name="cloudUpload" size={18} />
          Import workflow
        </Button>
        <input
          ref={importInput}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Import workflow file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file !== undefined) {
              void perform('import', () => onImport(file));
            }
            event.currentTarget.value = '';
          }}
        />
      </>
    );
  const createDialog = (
    <Dialog
      open={choosingMode}
      title="New workflow"
      onCancel={() => {
        setChoosingMode(false);
      }}
    >
      <p>Choose the editing experience for this Workflow.</p>
      <div className="dialog__actions">
        <Button
          variant="quiet"
          onClick={() => {
            setChoosingMode(false);
          }}
        >
          Cancel
        </Button>
        {(['quick', 'detailed'] as const).map((mode) => (
          <Button
            key={mode}
            variant={mode === 'quick' ? 'primary' : 'secondary'}
            pending={pendingAction === `create:${mode}`}
            pendingLabel="Creating…"
            onClick={() =>
              void perform(`create:${mode}`, () => onCreate(mode)).then(
                (succeeded) => {
                  if (succeeded) setChoosingMode(false);
                },
              )
            }
          >
            {mode === 'quick' ? 'Quick setup' : 'Detailed setup'}
          </Button>
        ))}
      </div>
    </Dialog>
  );

  if (workflows.length === 0) {
    return (
      <section
        className="workflow-library"
        aria-labelledby="workflow-library-title"
      >
        <div className="workflow-library__header">
          <div>
            <h1 id="workflow-library-title">Workflows</h1>
            <p>Choose or shape your next focus ritual.</p>
          </div>
          <div className="workflow-library__page-actions">
            {createButton('Create workflow')}
            {importControl}
          </div>
        </div>
        <div className="workflow-library--empty">
          <h2>Build your first focus rhythm.</h2>
          <p>
            Combine focus, breaks, sound and atmosphere into a Workflow you can
            return to.
          </p>
        </div>
        {error === null ? null : <p role="alert">{error}</p>}
        {createDialog}
      </section>
    );
  }

  return (
    <section
      className="workflow-library"
      aria-labelledby="workflow-library-title"
    >
      <div className="workflow-library__header">
        <div>
          <h1 id="workflow-library-title">Workflows</h1>
          <p>Choose a rhythm or shape a new one.</p>
        </div>
        <div className="workflow-library__page-actions">
          <Button
            variant="primary"
            onClick={() => {
              setChoosingMode(true);
            }}
          >
            <Icon name="addCircle" size={18} />
            New workflow
          </Button>
          {importControl}
        </div>
      </div>
      <div className="workflow-library__toolbar">
        <label className="workflow-library__search">
          <span className="visually-hidden">Search workflows</span>
          <Icon name="search" size={18} />
          <input
            type="search"
            aria-label="Search workflows"
            placeholder="Search workflows"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
          />
        </label>
        <div className="workflow-library__sort">
          <span>
            {String(renderedWorkflowCount)}{' '}
            {renderedWorkflowCount === 1 ? 'workflow' : 'workflows'}
          </span>
          <Select
            label="Sort workflows"
            value={sort}
            onChange={(event) => {
              setSort(event.currentTarget.value as WorkflowSort);
            }}
          >
            <option value="manual">Manual order</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </Select>
        </div>
      </div>

      {error === null || deleting !== null ? null : (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}
      {groups.length === 0 ? <p>No Workflows match your search.</p> : null}
      {groups.map(({ mode, values }) => (
        <div
          className="workflow-library__group"
          role="group"
          aria-label={mode === 'quick' ? 'Quick' : 'Detailed'}
          key={mode}
        >
          <h3>{mode === 'quick' ? 'Quick' : 'Detailed'}</h3>
          <ol className="workflow-list">
            {values.map((workflow) => {
              const externallyBusy = busyWorkflowId === workflow.id;
              const sourceGroup = workflows.filter(
                ({ mode: sourceMode }) => sourceMode === workflow.mode,
              );
              const sourceIndex = sourceGroup.findIndex(
                ({ id }) => id === workflow.id,
              );
              const thumbnail = renderThumbnail?.(workflow);
              return (
                <li
                  className="workflow-list__item"
                  key={workflow.id}
                  aria-label={workflow.name}
                  aria-current={
                    selectedWorkflowId === workflow.id ? 'true' : undefined
                  }
                >
                  <div
                    className={`workflow-list__thumbnail${thumbnail === undefined ? ' workflow-list__thumbnail--fallback' : ''}`}
                    data-testid={`workflow-thumbnail-${workflow.id}`}
                    style={
                      thumbnail === undefined
                        ? {
                            backgroundColor:
                              workflow.phases[0].environment.backgroundColor,
                          }
                        : undefined
                    }
                  >
                    {thumbnail}
                  </div>
                  <div className="workflow-list__content">
                    <div className="workflow-list__identity">
                      <span className="workflow-mode-badge">
                        {workflow.mode === 'quick' ? 'Quick' : 'Detailed'}
                      </span>
                      <strong>{workflow.name}</strong>
                    </div>
                    <span className="workflow-list__metadata">
                      <span>
                        <small>Total time</small>
                        <strong>{formatWorkflowDuration(workflow)}</strong>
                        <small>
                          {String(workflow.phases.length)}{' '}
                          {workflow.phases.length === 1 ? 'phase' : 'phases'}
                        </small>
                      </span>
                      <span>
                        <small>Reward Dice</small>
                        <strong>
                          Reward{' '}
                          {workflow.rewardDice === undefined ? 'off' : 'on'}
                        </strong>
                      </span>
                    </span>
                  </div>
                  <div className="workflow-list__actions">
                    <Button
                      variant="primary"
                      aria-label={`Open ${workflow.name}`}
                      onClick={() => {
                        onOpen(workflow.id);
                      }}
                    >
                      <Icon name="open" size={18} />
                      Open
                    </Button>
                    {onStart === undefined ? null : (
                      <Button
                        variant="secondary"
                        aria-label={`Start workflow: ${workflow.name}`}
                        pending={pendingAction === `start:${workflow.id}`}
                        pendingLabel="Starting…"
                        onClick={() =>
                          void perform(`start:${workflow.id}`, () =>
                            onStart(workflow.id),
                          )
                        }
                      >
                        Start workflow
                      </Button>
                    )}
                    {onExport === undefined ? null : (
                      <Button
                        variant="quiet"
                        iconOnly
                        aria-label={`Export ${workflow.name}`}
                        pending={pendingAction === `export:${workflow.id}`}
                        pendingLabel="Exporting…"
                        onClick={() =>
                          void perform(`export:${workflow.id}`, () =>
                            onExport(workflow.id),
                          )
                        }
                      >
                        <Icon name="export" size={18} />
                      </Button>
                    )}
                    <Button
                      buttonRef={(node) => {
                        if (node === null) {
                          overflowTriggers.current.delete(workflow.id);
                        } else {
                          overflowTriggers.current.set(workflow.id, node);
                        }
                      }}
                      variant="quiet"
                      iconOnly
                      aria-label={`More actions for ${workflow.name}`}
                      aria-expanded={openActionsId === workflow.id}
                      onClick={() => {
                        setOpenActionsId((current) =>
                          current === workflow.id ? null : workflow.id,
                        );
                      }}
                    >
                      <Icon name="more" size={18} />
                    </Button>
                    {openActionsId !== workflow.id ? null : (
                      <div className="workflow-list__overflow">
                        {sort !== 'manual' ? null : (
                          <>
                            <Button
                              variant="quiet"
                              aria-label={`Move ${workflow.name} up`}
                              disabled={sourceIndex === 0 || externallyBusy}
                              pending={pendingAction === `up:${workflow.id}`}
                              pendingLabel="Moving…"
                              onClick={() => {
                                performOverflow(
                                  workflow.id,
                                  `up:${workflow.id}`,
                                  () => onReorder(reordered(workflow, -1)),
                                );
                              }}
                            >
                              Move up
                            </Button>
                            <Button
                              variant="quiet"
                              aria-label={`Move ${workflow.name} down`}
                              disabled={
                                sourceIndex === sourceGroup.length - 1 ||
                                externallyBusy
                              }
                              pending={pendingAction === `down:${workflow.id}`}
                              pendingLabel="Moving…"
                              onClick={() => {
                                performOverflow(
                                  workflow.id,
                                  `down:${workflow.id}`,
                                  () => onReorder(reordered(workflow, 1)),
                                );
                              }}
                            >
                              Move down
                            </Button>
                          </>
                        )}
                        <Button
                          variant="quiet"
                          aria-label={`Duplicate ${workflow.name}`}
                          disabled={externallyBusy}
                          pending={pendingAction === `duplicate:${workflow.id}`}
                          pendingLabel="Duplicating…"
                          onClick={() => {
                            performOverflow(
                              workflow.id,
                              `duplicate:${workflow.id}`,
                              () => onDuplicate(workflow.id),
                            );
                          }}
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="quiet"
                          aria-label={`Delete ${workflow.name}`}
                          disabled={externallyBusy}
                          onClick={() => {
                            setOpenActionsId(null);
                            setDeleting(workflow);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {createDialog}
      <Dialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'Workflow'}?`}
        onCancel={() => {
          setDeleting(null);
        }}
      >
        <p>This removes the Workflow. Shared Assets remain in your library.</p>
        {error === null ? null : (
          <p className="feedback feedback--error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button
            variant="quiet"
            onClick={() => {
              setDeleting(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={
              deleting !== null && pendingAction === `delete:${deleting.id}`
            }
            pendingLabel="Deleting…"
            onClick={() => {
              if (deleting === null) return;
              const target = deleting;
              void perform(`delete:${target.id}`, () =>
                onDelete(target.id),
              ).then((succeeded) => {
                if (succeeded) setDeleting(null);
              });
            }}
          >
            Delete workflow
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
