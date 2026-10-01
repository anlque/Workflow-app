import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole } from '@/features/assets';
import { defaultSettings } from '@/features/settings';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';
import {
  createWorkflow,
  type CreateWorkflowInput,
  type Workflow,
} from '@/features/workflow';

import {
  WorkflowStudio,
  type WorkflowStudioDependencies,
} from './WorkflowStudio';

const imageAsset = createAsset({
  id: 'default-image',
  name: 'Image',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1,
});
const audioAsset = createAsset({
  id: 'default-audio',
  name: 'Audio',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 1,
  createdAt: 1,
});

function dependencies(
  overrides: Partial<WorkflowStudioDependencies> = {},
): WorkflowStudioDependencies {
  return {
    preferences: createTestDocumentPreferences(),
    load: () =>
      Promise.resolve({ workflows: [], assets: [], settings: defaultSettings }),
    saveWorkflow: () => Promise.resolve(),
    duplicateWorkflow: () => Promise.resolve(),
    deleteWorkflow: () => Promise.resolve(),
    reorderWorkflows: () => Promise.resolve(),
    importAsset: (_file, kind) =>
      Promise.resolve(kind === 'image' ? imageAsset : audioAsset),
    synchronizeAssetImport: () => Promise.resolve(),
    inspectAssetRetirement: (id) =>
      Promise.resolve({
        asset: createAsset({
          id,
          name: String(id),
          kind: 'image',
          mimeType: 'image/png',
          byteSize: 1,
          createdAt: 1,
        }),
        usages: [],
      }),
    retireAsset: () => Promise.resolve(),
    synchronizeAssetRetirement: () => Promise.resolve(),
    createAssetRetirementUploadInput: (file, kind) => ({
      id: 'replacement-id',
      name: file.name,
      kind,
      blob: file,
      createdAt: 1,
    }),
    inspectAssetRoleChange: (id, value) =>
      Promise.resolve({
        target: createAsset({
          id,
          name: String(id),
          kind: 'image',
          mimeType: 'image/png',
          byteSize: 1,
          createdAt: 1,
        }),
        role: createAssetRole(value),
        action: 'create',
        currentOwner: null,
        affectedWorkflowCount: 0,
        expectedKinds: [],
      }),
    applyAssetRoleChange: () => Promise.resolve(),
    synchronizeAssetRoleChange: () => Promise.resolve(),
    loadAssetBlob: () => Promise.resolve(null),
    createObjectUrl: () => 'blob:asset',
    revokeObjectUrl: () => undefined,
    updateSettings: () => Promise.resolve(),
    exportSettings: () => Promise.resolve(),
    importSettings: () => Promise.resolve(),
    exportWorkflow: () => Promise.resolve(),
    importWorkflow: () => Promise.resolve(),
    createId: () => 'new-id',
    ...overrides,
  };
}

describe('WorkflowStudio', () => {
  test('keeps a new draft selected while reloading the catalog after inline upload', async () => {
    const user = userEvent.setup();
    const existing = createWorkflow({
      id: 'existing-workflow',
      name: 'Saved name',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const uploaded = createAsset({
      id: 'uploaded-image',
      name: 'New backdrop',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 5,
      createdAt: 2,
    });
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        workflows: [existing],
        assets: [],
        settings: defaultSettings,
      })
      .mockResolvedValueOnce({
        workflows: [existing],
        assets: [uploaded],
        settings: defaultSettings,
      });
    const importAsset = vi.fn(() => Promise.resolve(uploaded));
    render(
      <WorkflowStudio dependencies={dependencies({ load, importAsset })} />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'New workflow' }),
    );
    await user.type(screen.getByLabelText('Workflow name'), 'New draft');
    await user.type(screen.getByLabelText('Phase 1 name'), 'Writing');
    await user.type(screen.getByLabelText('Background color'), '#123456');
    await user.upload(
      screen.getByLabelText('Upload image'),
      new File(['image'], 'backdrop.png', { type: 'image/png' }),
    );

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByLabelText('Workflow name')).toHaveValue('New draft');
    expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Writing');
    expect(screen.getByLabelText('Background color')).toHaveValue('#123456');
    expect(screen.getByLabelText('Background image')).toHaveValue(
      'direct:uploaded-image',
    );
    expect(importAsset).toHaveBeenCalledOnce();
  });

  test.each(['publication', 'load'] as const)(
    'preserves the draft and retries only synchronization after an inline upload %s failure',
    async (failure) => {
      const user = userEvent.setup();
      const uploaded = createAsset({
        id: 'uploaded-image',
        name: 'New backdrop',
        kind: 'image',
        mimeType: 'image/png',
        byteSize: 5,
        createdAt: 2,
      });
      const existing = createWorkflow({
        id: 'existing-workflow',
        name: 'Saved name',
        phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
      });
      const empty = {
        workflows: [existing],
        assets: [],
        settings: defaultSettings,
      };
      const populated = {
        workflows: [existing],
        assets: [uploaded],
        settings: defaultSettings,
      };
      const load =
        failure === 'load'
          ? vi
              .fn()
              .mockResolvedValueOnce(empty)
              .mockRejectedValueOnce(new Error('Reload failed.'))
              .mockResolvedValueOnce(populated)
          : vi
              .fn()
              .mockResolvedValueOnce(empty)
              .mockResolvedValueOnce(populated);
      const importAsset = vi.fn(() => Promise.resolve(uploaded));
      const synchronizeAssetImport =
        failure === 'publication'
          ? vi
              .fn<() => Promise<void>>()
              .mockRejectedValueOnce(new Error('Publication failed.'))
              .mockResolvedValueOnce()
          : vi.fn(() => Promise.resolve());
      render(
        <WorkflowStudio
          dependencies={dependencies({
            load,
            importAsset,
            synchronizeAssetImport,
          })}
        />,
      );

      await user.click(
        await screen.findByRole('button', { name: 'New workflow' }),
      );
      await user.type(screen.getByLabelText('Workflow name'), 'Uncommitted');
      await user.type(screen.getByLabelText('Phase 1 name'), 'Writing');
      await user.upload(
        screen.getByLabelText('Upload image'),
        new File(['image'], 'backdrop.png', { type: 'image/png' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Asset was added, but the catalog could not be refreshed.',
      );
      expect(screen.getByLabelText('Workflow name')).toHaveValue('Uncommitted');
      expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Writing');
      expect(screen.getByLabelText('Background image')).toHaveValue(
        'direct:uploaded-image',
      );

      await user.click(screen.getByRole('button', { name: 'Retry sync' }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Retry sync' })).toBeNull();
      });
      expect(importAsset).toHaveBeenCalledOnce();
      expect(synchronizeAssetImport).toHaveBeenCalledTimes(2);
      expect(load).toHaveBeenCalledTimes(failure === 'load' ? 3 : 2);
      expect(screen.getByLabelText('Workflow name')).toHaveValue('Uncommitted');
      expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Writing');
      expect(screen.getByLabelText('Background image')).toHaveValue(
        'direct:uploaded-image',
      );
    },
  );
  test.each(['publication', 'load'] as const)(
    'retries %s after committed retirement without repeating the mutation',
    async (failure) => {
      const user = userEvent.setup();
      const source = createAsset({
        id: 'source',
        name: 'Forest',
        kind: 'image',
        mimeType: 'image/png',
        byteSize: 1,
        createdAt: 1,
      });
      const populated = {
        workflows: [],
        assets: [source],
        settings: defaultSettings,
      };
      const retired = {
        workflows: [],
        assets: [],
        settings: defaultSettings,
      };
      const load =
        failure === 'load'
          ? vi
              .fn()
              .mockResolvedValueOnce(populated)
              .mockRejectedValueOnce(new Error('Catalog reload failed.'))
              .mockResolvedValueOnce(retired)
          : vi
              .fn()
              .mockResolvedValueOnce(populated)
              .mockResolvedValueOnce(retired);
      const retire = vi.fn(() => Promise.resolve());
      const synchronize =
        failure === 'publication'
          ? vi
              .fn()
              .mockRejectedValueOnce(new Error('Catalog publication failed.'))
              .mockResolvedValueOnce(undefined)
          : vi.fn(() => Promise.resolve());
      const deps = dependencies({
        load,
        retireAsset: retire,
        synchronizeAssetRetirement: synchronize,
        inspectAssetRetirement: () =>
          Promise.resolve({ asset: source, usages: [] }),
      });
      render(<WorkflowStudio dependencies={deps} />);

      await user.click(await screen.findByRole('tab', { name: 'Assets' }));
      await user.click(screen.getByRole('button', { name: 'Retire Forest' }));
      await user.click(screen.getByRole('button', { name: 'Review usage' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(
        screen.getByRole('radio', { name: 'Remove optional references' }),
      );
      await user.click(screen.getByRole('button', { name: 'Retire asset' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        failure === 'publication'
          ? 'Catalog publication failed.'
          : 'Catalog reload failed.',
      );
      await user.click(screen.getByRole('button', { name: 'Retry sync' }));

      expect(retire).toHaveBeenCalledOnce();
      expect(synchronize).toHaveBeenCalledTimes(2);
      expect(load).toHaveBeenCalledTimes(failure === 'load' ? 3 : 2);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  test('recovers an updated snapshot after a post-commit load failure without reapplying the Role change', async () => {
    const user = userEvent.setup();
    const initial = createAsset({
      id: 'image',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
    });
    const updated = createAsset({ ...initial, role: 'Hero' });
    const snapshot = (assets: readonly (typeof initial)[]) => ({
      workflows: [],
      assets,
      settings: defaultSettings,
    });
    const load = vi
      .fn()
      .mockResolvedValueOnce(snapshot([initial]))
      .mockRejectedValueOnce(new Error('Storage reload failed.'))
      .mockResolvedValueOnce(snapshot([updated]));
    const apply = vi.fn(() => Promise.resolve());
    const synchronize = vi.fn(() => Promise.resolve());
    const deps = dependencies({
      load,
      applyAssetRoleChange: apply,
      synchronizeAssetRoleChange: synchronize,
      inspectAssetRoleChange: vi
        .fn()
        .mockResolvedValueOnce({
          target: initial,
          role: createAssetRole('Hero'),
          action: 'create',
          currentOwner: null,
          affectedWorkflowCount: 0,
          expectedKinds: [],
        })
        .mockResolvedValueOnce({
          target: updated,
          role: createAssetRole('Hero'),
          action: 'unchanged',
          currentOwner: updated,
          affectedWorkflowCount: 0,
          expectedKinds: [],
        }),
    });
    render(<WorkflowStudio dependencies={deps} />);
    await user.click(await screen.findByRole('tab', { name: 'Assets' }));
    await user.click(
      screen.getByRole('button', { name: 'Manage role for Forest' }),
    );
    await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Hero');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: 'Assign role' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage reload failed.',
    );
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: 'Retry sync' }));

    expect(apply).toHaveBeenCalledOnce();
    expect(synchronize).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole('listitem', { name: 'Image: Forest' }),
    ).toHaveTextContent('Role: Hero');
  });

  test('forwards an approved Role change and reloads the catalog once', async () => {
    const user = userEvent.setup();
    const load = vi.fn(() =>
      Promise.resolve({
        workflows: [],
        assets: [asset],
        settings: defaultSettings,
      }),
    );
    const applyAssetRoleChange = vi.fn(() => Promise.resolve());
    const asset = createAsset({
      id: 'image',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
    });
    const preview = {
      target: asset,
      role: createAssetRole('Hero'),
      action: 'create' as const,
      currentOwner: null,
      affectedWorkflowCount: 0,
      expectedKinds: [],
    };
    const deps = dependencies({
      load,
      inspectAssetRoleChange: vi.fn(() => Promise.resolve(preview)),
      applyAssetRoleChange,
    });
    render(<WorkflowStudio dependencies={deps} />);
    await user.click(await screen.findByRole('tab', { name: 'Assets' }));
    await user.click(
      screen.getByRole('button', { name: 'Manage role for Forest' }),
    );
    await user.type(screen.getByLabelText('Role'), 'Hero');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(
      await screen.findByRole('button', { name: 'Assign role' }),
    );

    expect(applyAssetRoleChange).toHaveBeenCalledWith(preview);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('does not recreate a playing audio preview after importing an image', async () => {
    const user = userEvent.setup();
    const audio = createAsset({
      id: 'audio-1',
      name: 'Rain',
      kind: 'audio',
      mimeType: 'audio/mpeg',
      byteSize: 5,
      createdAt: 1,
    });
    const image = createAsset({
      id: 'image-1',
      name: 'Forest',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 5,
      createdAt: 2,
    });
    let assets = [audio];
    const deps = dependencies({
      load: vi.fn(() =>
        Promise.resolve({ workflows: [], assets, settings: defaultSettings }),
      ),
      loadAssetBlob: vi.fn(() => Promise.resolve(new Blob(['audio']))),
      createObjectUrl: vi.fn(() => 'blob:rain'),
      revokeObjectUrl: vi.fn(),
      importAsset: vi.fn(() => {
        assets = [audio, image];
        return Promise.resolve(image);
      }),
    });
    render(<WorkflowStudio dependencies={deps} />);
    await user.click(await screen.findByRole('tab', { name: 'Assets' }));
    const playing = await screen.findByLabelText('Preview Rain');
    (playing as HTMLAudioElement).currentTime = 7;

    await user.upload(
      screen.getByLabelText('Add local image or audio'),
      new File(['image'], 'forest.png', { type: 'image/png' }),
    );
    await screen.findByRole('img', { name: 'Preview of Forest' });

    expect(screen.getByLabelText('Preview Rain')).toBe(playing);
    expect((playing as HTMLAudioElement).currentTime).toBe(7);
    expect(deps.loadAssetBlob).toHaveBeenCalledTimes(2);
    expect(deps.createObjectUrl).toHaveBeenCalledTimes(2);
    expect(deps.revokeObjectUrl).not.toHaveBeenCalled();
  });

  test('shows theme and motion changes received from another document', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    const preferences = deps.preferences as ReturnType<
      typeof createTestDocumentPreferences
    >;
    render(<WorkflowStudio dependencies={deps} />);
    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue(
      'system',
    );
    act(() => {
      preferences.setSnapshot({
        theme: 'dark',
        reducedMotion: 'reduce',
        effectiveReducedMotion: true,
      });
    });
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('dark');
    expect(
      screen.getByRole('combobox', { name: 'Reduced motion' }),
    ).toHaveValue('reduce');
  });

  test('provides a keyboard-operable three-tab workspace', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WorkflowStudio dependencies={dependencies()} />,
    );

    const workflowsTab = await screen.findByRole('tab', { name: 'Workflows' });
    expect(workflowsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Workflows' })).toBeVisible();

    workflowsTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Assets' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Assets' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Assets' })).toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Workflows' })).toBeNull();
    expect(container.querySelector('.brand-logo')).toHaveAttribute(
      'src',
      '/brand/locusora-mark.svg',
    );
  });

  test('activates the Settings tab by click', async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio dependencies={dependencies()} />);

    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(screen.getByRole('tabpanel', { name: 'Settings' })).toBeVisible();
  });

  test('falls back to the first Workflow when the saved selection is unavailable', async () => {
    const first = createWorkflow({
      id: 'first-workflow',
      name: 'First',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const unavailable = createWorkflow({
      id: 'unavailable-workflow',
      name: 'Unavailable',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const deps = dependencies({
      load: () =>
        Promise.resolve({
          workflows: [first],
          assets: [],
          settings: {
            ...defaultSettings,
            lastSelectedWorkflowId: unavailable.id,
          },
        }),
    });

    render(<WorkflowStudio dependencies={deps} />);

    expect(
      (await screen.findByRole('button', { name: 'Open First' })).closest('li'),
    ).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Workflow name')).toHaveValue('First');
  });

  test('keeps the editor mounted long enough to announce a successful save', async () => {
    const user = userEvent.setup();
    let workflows: readonly Workflow[] = [];
    let finishReload: (() => void) | undefined;
    const load = vi
      .fn(() =>
        Promise.resolve({ workflows, assets: [], settings: defaultSettings }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ workflows, assets: [], settings: defaultSettings }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishReload = () => {
              resolve({ workflows, assets: [], settings: defaultSettings });
            };
          }),
      );
    const deps = dependencies({
      load,
      saveWorkflow: vi.fn((input: CreateWorkflowInput) => {
        workflows = [createWorkflow(input)];
        return Promise.resolve();
      }),
    });
    render(<WorkflowStudio dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Create workflow' }),
    );
    await user.type(screen.getByLabelText('Workflow name'), 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    finishReload?.();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Workflow saved',
    );
  });

  test('announces loading failures', async () => {
    const broken = dependencies({
      load: vi.fn(() => Promise.reject(new Error('Database unavailable.'))),
    });
    render(<WorkflowStudio dependencies={broken} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database unavailable.',
    );
  });
});
