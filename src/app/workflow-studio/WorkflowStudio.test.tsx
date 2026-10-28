import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole } from '@/features/assets';
import { defaultSettings } from '@/features/settings';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';
import {
  createWorkflow,
  createWorkflowId,
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
    openSidePanel: () => Promise.resolve(),
    closeSidePanel: () => Promise.resolve(),
    subscribeSidePanelState: () => () => undefined,
    load: () =>
      Promise.resolve({ workflows: [], assets: [], settings: defaultSettings }),
    saveWorkflow: () => Promise.resolve(),
    convertQuickWorkflow: () => Promise.resolve(),
    synchronizeWorkflowConversion: () => Promise.resolve(),
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
  test.each(['Assets', 'Settings'])(
    'preserves a new Detailed draft and selected Phase across Workflows → %s → Workflows',
    async (destination) => {
      const user = userEvent.setup();
      const saveWorkflow = vi.fn(() => Promise.resolve());
      render(
        <WorkflowStudio
          dependencies={dependencies({
            load: () =>
              Promise.resolve({
                workflows: [],
                assets: [],
                settings: defaultSettings,
              }),
            saveWorkflow,
          })}
        />,
      );

      await user.click(
        await screen.findByRole('button', { name: 'Create workflow' }),
      );
      await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
      await user.type(screen.getByLabelText('Workflow name'), 'Draft ritual');
      await user.click(screen.getByRole('button', { name: 'Add phase' }));
      await user.click(screen.getByRole('button', { name: /Select Phase 2/ }));

      await user.click(screen.getByRole('tab', { name: destination }));
      expect(screen.getByLabelText('Workflow name')).not.toBeVisible();
      await user.click(screen.getByRole('tab', { name: 'Workflows' }));

      expect(screen.getByLabelText('Workflow name')).toHaveValue(
        'Draft ritual',
      );
      expect(
        screen.getByRole('button', { name: /Select Phase 2/ }),
      ).toHaveAttribute('aria-pressed', 'true');
      await user.click(screen.getByRole('button', { name: 'Save workflow' }));
      expect(saveWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-id', name: 'Draft ritual' }),
      );
    },
  );

  test.each([
    'asset import',
    'settings update',
    'settings import',
    'workflow import',
  ] as const)(
    'keeps a new Detailed editor identity across an authoritative %s refresh',
    async (operation) => {
      const user = userEvent.setup();
      const existing = createWorkflow({
        id: 'existing-workflow',
        name: 'Existing Workflow',
        phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
      });
      const uploaded = createAsset({
        id: 'uploaded-image',
        name: 'Uploaded image',
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
        .mockResolvedValue({
          workflows: [existing],
          assets: operation === 'asset import' ? [uploaded] : [],
          settings: defaultSettings,
        });
      const saveWorkflow = vi.fn(() => Promise.resolve());
      render(
        <WorkflowStudio
          dependencies={dependencies({
            load,
            saveWorkflow,
            importAsset: () => Promise.resolve(uploaded),
          })}
        />,
      );

      await user.click(
        await screen.findByRole('button', { name: 'Back to workflows' }),
      );
      await user.click(screen.getByRole('button', { name: 'New workflow' }));
      await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
      await user.type(screen.getByLabelText('Workflow name'), 'Unsaved draft');
      await user.type(screen.getByLabelText('Phase 1 name'), 'First draft');
      await user.click(screen.getByRole('button', { name: 'Add phase' }));
      await user.click(screen.getByRole('button', { name: /Select Phase 2/ }));
      await user.type(screen.getByLabelText('Phase 2 name'), 'Selected draft');

      if (operation === 'asset import') {
        await user.click(screen.getByRole('tab', { name: 'Assets' }));
        await user.upload(
          screen.getByLabelText('Add local image or audio'),
          new File(['image'], 'background.png', { type: 'image/png' }),
        );
      } else {
        await user.click(screen.getByRole('tab', { name: 'Settings' }));
        if (operation === 'settings update') {
          await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
        } else {
          await user.upload(
            screen.getByLabelText(
              operation === 'settings import'
                ? 'Import settings file'
                : 'Import workflow file',
            ),
            new File(['{}'], 'package.json', { type: 'application/json' }),
          );
        }
      }

      await waitFor(() => {
        expect(load).toHaveBeenCalledTimes(2);
      });
      await user.click(screen.getByRole('tab', { name: 'Workflows' }));
      expect(screen.getByLabelText('Workflow name')).toHaveValue(
        'Unsaved draft',
      );
      expect(screen.getByLabelText('Phase 2 name')).toHaveValue(
        'Selected draft',
      );
      expect(
        screen.getByRole('button', { name: /Select Phase 2/ }),
      ).toHaveAttribute('aria-pressed', 'true');

      await user.click(screen.getByRole('button', { name: 'Save workflow' }));
      expect(saveWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-id', name: 'Unsaved draft' }),
      );
    },
  );

  test('preserves unsaved Detailed fields while synchronizing renamed Role references', async () => {
    const user = userEvent.setup();
    const saveWorkflow = vi.fn(() => Promise.resolve());
    const asset = createAsset({
      id: 'hero-image',
      name: 'Hero image',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: 'Hero',
    });
    const initial = createWorkflow({
      id: 'workflow-role-sync',
      name: 'Persisted name',
      phases: [
        {
          type: 'focus',
          durationSeconds: 1_500,
          environment: {
            backgroundAsset: { type: 'role', role: 'Hero' },
          },
        },
      ],
    });
    const renamed = createWorkflow({
      id: initial.id,
      name: initial.name,
      phases: [
        {
          type: 'focus',
          durationSeconds: 1_500,
          environment: {
            backgroundAsset: { type: 'role', role: 'Scene' },
          },
        },
      ],
    });
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        workflows: [initial],
        assets: [asset],
        settings: defaultSettings,
      })
      .mockResolvedValueOnce({
        workflows: [renamed],
        assets: [createAsset({ ...asset, role: 'Scene' })],
        settings: defaultSettings,
      });
    render(
      <WorkflowStudio
        dependencies={dependencies({
          load,
          saveWorkflow,
          inspectAssetRoleChange: () =>
            Promise.resolve({
              target: asset,
              role: createAssetRole('Scene'),
              action: 'rename',
              currentOwner: asset,
              affectedWorkflowCount: 1,
              expectedKinds: ['image'],
            }),
        })}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Back to workflows' }),
    );
    await user.click(screen.getByRole('button', { name: 'New workflow' }));
    await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
    const name = screen.getByLabelText('Workflow name');
    await user.clear(name);
    await user.type(name, 'Unsaved Workflow');
    await user.type(screen.getByLabelText('Phase 1 name'), 'Unsaved Phase');
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      'role:hero',
    );
    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    await user.click(
      screen.getByRole('button', { name: 'Manage role for Hero image' }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Role' }));
    await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Scene');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: 'Rename role' }));
    await user.click(screen.getByRole('tab', { name: 'Workflows' }));

    expect(screen.getByLabelText('Workflow name')).toHaveValue(
      'Unsaved Workflow',
    );
    expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Unsaved Phase');
    expect(screen.getByLabelText('Background image')).toHaveValue('role:scene');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(saveWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-id', name: 'Unsaved Workflow' }),
    );
  });

  test('preserves unsaved Detailed fields while synchronizing retired direct references', async () => {
    const user = userEvent.setup();
    const saveWorkflow = vi.fn(() => Promise.resolve());
    const source = createAsset({
      id: 'source-image',
      name: 'Source image',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: 'Scene',
    });
    const replacement = createAsset({
      id: 'replacement-image',
      name: 'Replacement image',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 2,
    });
    const workflow = (assetId: string) =>
      createWorkflow({
        id: 'workflow-retirement-sync',
        name: 'Persisted name',
        phases: [
          {
            type: 'focus',
            durationSeconds: 1_500,
            environment: {
              backgroundAsset: { type: 'direct', assetId },
            },
          },
        ],
      });
    const initial = workflow(source.id);
    const replacementWithRole = createAsset({ ...replacement, role: 'Scene' });
    const retired = workflow(replacement.id);
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        workflows: [initial],
        assets: [source, replacement],
        settings: defaultSettings,
      })
      .mockResolvedValueOnce({
        workflows: [retired],
        assets: [replacementWithRole],
        settings: defaultSettings,
      });
    render(
      <WorkflowStudio
        dependencies={dependencies({
          load,
          saveWorkflow,
          inspectAssetRetirement: () =>
            Promise.resolve({
              asset: source,
              usages: [
                {
                  workflowId: initial.id,
                  workflowName: initial.name,
                  occurrences: [
                    {
                      owner: 'phase',
                      phaseIndex: 0,
                      location: 'background',
                      referenceMode: 'direct',
                      optional: true,
                    },
                  ],
                },
              ],
            }),
        })}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Back to workflows' }),
    );
    await user.click(screen.getByRole('button', { name: 'New workflow' }));
    await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
    const name = screen.getByLabelText('Workflow name');
    await user.clear(name);
    await user.type(name, 'Unsaved Workflow');
    await user.type(screen.getByLabelText('Phase 1 name'), 'Unsaved Phase');
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      `direct:${source.id}`,
    );
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    await user.click(screen.getByRole('button', { name: /Select Phase 2/ }));
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      'role:scene',
    );
    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    await user.click(
      screen.getByRole('button', { name: 'Retire Source image' }),
    );
    await user.click(screen.getByRole('button', { name: 'Review usage' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Replacement Asset' }),
      replacement.id,
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    await user.click(screen.getByRole('tab', { name: 'Workflows' }));

    expect(screen.getByLabelText('Workflow name')).toHaveValue(
      'Unsaved Workflow',
    );
    await user.click(screen.getByRole('button', { name: /Select Phase 1/ }));
    expect(screen.getByLabelText('Phase 1 name')).toHaveValue('Unsaved Phase');
    expect(screen.getByLabelText('Background image')).toHaveValue(
      `direct:${replacement.id}`,
    );
    await user.click(screen.getByRole('button', { name: /Select Phase 2/ }));
    expect(screen.getByLabelText('Background image')).toHaveValue('role:scene');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(saveWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-id', name: 'Unsaved Workflow' }),
    );
  });

  test('removes direct and Role references from a new Detailed draft when the owning Asset is removed', async () => {
    const user = userEvent.setup();
    const saveWorkflow = vi.fn(() => Promise.resolve());
    const source = createAsset({
      id: 'retired-role-owner',
      name: 'Retired role owner',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 1,
      role: 'Scene',
    });
    const existing = createWorkflow({
      id: 'existing-workflow',
      name: 'Existing Workflow',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        workflows: [existing],
        assets: [source],
        settings: defaultSettings,
      })
      .mockResolvedValueOnce({
        workflows: [existing],
        assets: [],
        settings: defaultSettings,
      });
    render(
      <WorkflowStudio
        dependencies={dependencies({
          load,
          saveWorkflow,
          inspectAssetRetirement: () =>
            Promise.resolve({ asset: source, usages: [] }),
        })}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Back to workflows' }),
    );
    await user.click(screen.getByRole('button', { name: 'New workflow' }));
    await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
    await user.type(screen.getByLabelText('Workflow name'), 'Unsaved removal');
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      `direct:${source.id}`,
    );
    await user.click(screen.getByRole('button', { name: 'Add phase' }));
    await user.click(screen.getByRole('button', { name: /Select Phase 2/ }));
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      'role:scene',
    );

    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    await user.click(
      screen.getByRole('button', { name: 'Retire Retired role owner' }),
    );
    await user.click(screen.getByRole('button', { name: 'Review usage' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(
      screen.getByRole('radio', { name: 'Remove optional references' }),
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    await user.click(screen.getByRole('tab', { name: 'Workflows' }));

    expect(screen.getByLabelText('Workflow name')).toHaveValue(
      'Unsaved removal',
    );
    expect(screen.getByLabelText('Background image')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: /Select Phase 1/ }));
    expect(screen.getByLabelText('Background image')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    expect(saveWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-id', name: 'Unsaved removal' }),
    );
  });

  test('moves between the approved library and editor views without discarding a Detailed draft', async () => {
    const user = userEvent.setup();
    const saved = createWorkflow({
      id: 'saved-workflow',
      name: 'Saved workflow',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    render(
      <WorkflowStudio
        dependencies={dependencies({
          load: () =>
            Promise.resolve({
              workflows: [saved],
              assets: [],
              settings: {
                ...defaultSettings,
                lastSelectedWorkflowId: saved.id,
              },
            }),
        })}
      />,
    );

    const workflowName = await screen.findByLabelText('Workflow name');
    await user.clear(workflowName);
    await user.type(workflowName, 'Unsaved name');
    await user.click(screen.getByRole('button', { name: 'Back to workflows' }));
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeVisible();
    expect(screen.getByLabelText('Workflow name')).not.toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Open Saved workflow' }),
    );
    expect(screen.getByLabelText('Workflow name')).toHaveValue('Unsaved name');
  });

  test('keeps every live audio and appearance preference while theme and motion change', async () => {
    const user = userEvent.setup();
    const preferences = createTestDocumentPreferences();
    const load = vi.fn(() =>
      Promise.resolve({
        workflows: [],
        assets: [],
        settings: {
          ...defaultSettings,
          lastSelectedWorkflowId: createWorkflowId('saved-workflow'),
        },
      }),
    );
    render(
      <WorkflowStudio dependencies={dependencies({ preferences, load })} />,
    );

    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    act(() => {
      preferences.setSnapshot({
        ...preferences.getSnapshot(),
        ambientVolumePercent: 24,
        ambientMuted: true,
        cueVolumePercent: 46,
        cuesMuted: true,
        muteCuesWithMusic: true,
        backgroundBlurPx: 14,
        backgroundBrightnessPercent: 125,
      });
    });

    expect(screen.getByRole('slider', { name: 'Music volume' })).toHaveValue(
      '24',
    );
    expect(screen.getByRole('slider', { name: 'Cue volume' })).toHaveValue(
      '46',
    );
    expect(screen.getByRole('checkbox', { name: 'Mute music' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Mute cues' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Mute cues with music' }),
    ).toBeChecked();
    expect(
      screen.getByRole('slider', { name: /^Background blur/ }),
    ).toHaveValue('14');
    expect(
      screen.getByRole('slider', { name: /^Background brightness/ }),
    ).toHaveValue('125');

    act(() => {
      preferences.setSnapshot({
        ...preferences.getSnapshot(),
        theme: 'dark',
        reducedMotion: 'reduce',
        effectiveReducedMotion: true,
      });
    });

    expect(screen.getByRole('slider', { name: 'Music volume' })).toHaveValue(
      '24',
    );
    expect(screen.getByRole('slider', { name: 'Cue volume' })).toHaveValue(
      '46',
    );
    expect(
      screen.getByRole('slider', { name: /^Background blur/ }),
    ).toHaveValue('14');
  });

  test('controls Side Panel state from lifecycle events and pending actions', async () => {
    const user = userEvent.setup();
    let notify: ((open: boolean) => void) | undefined;
    let finishOpen: (() => void) | undefined;
    const deps = dependencies();
    Object.assign(deps, {
      openSidePanel: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishOpen = resolve;
          }),
      ),
      closeSidePanel: vi.fn(() => Promise.resolve()),
      subscribeSidePanelState: vi.fn((listener: (open: boolean) => void) => {
        notify = listener;
        return vi.fn();
      }),
    });
    render(<WorkflowStudio dependencies={deps} />);

    const open = await screen.findByRole('button', {
      name: 'Open side panel',
    });
    await user.click(open);
    const close = screen.getByRole('button', { name: 'Close side panel' });
    expect(close).toBeDisabled();
    expect(close).toHaveAttribute('aria-busy', 'true');

    act(() => finishOpen?.());
    await waitFor(() => expect(close).toBeEnabled());
    act(() => notify?.(false));
    expect(
      screen.getByRole('button', { name: 'Open side panel' }),
    ).toBeVisible();
  });

  test('shows a recoverable Side Panel error and allows retry', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    const openSidePanel = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Unable to open the Side Panel.'))
      .mockResolvedValueOnce();
    Object.assign(deps, {
      openSidePanel,
      closeSidePanel: vi.fn(() => Promise.resolve()),
      subscribeSidePanelState: vi.fn(() => vi.fn()),
    });
    render(<WorkflowStudio dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Open side panel' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to open the Side Panel.',
    );
    expect(screen.getByRole('tab', { name: 'Workflows' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open side panel' }));
    expect(openSidePanel).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

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
      await screen.findByRole('button', { name: 'Back to workflows' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'New workflow' }),
    );
    await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
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

  test('creates and saves a Quick Workflow with the permanent Quick editor', async () => {
    const user = userEvent.setup();
    const saveWorkflow = vi.fn((input: CreateWorkflowInput) => {
      void input;
      return Promise.resolve();
    });
    const load = vi.fn(() =>
      Promise.resolve({ workflows: [], assets: [], settings: defaultSettings }),
    );
    render(
      <WorkflowStudio dependencies={dependencies({ load, saveWorkflow })} />,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Create workflow' }),
    );
    await user.click(screen.getByRole('button', { name: 'Quick setup' }));
    expect(screen.getByRole('heading', { name: 'Quick setup' })).toBeVisible();
    await user.type(screen.getByLabelText('Workflow name'), 'Fast flow');
    await user.click(screen.getByRole('button', { name: 'Save workflow' }));
    await waitFor(() => {
      expect(saveWorkflow).toHaveBeenCalledOnce();
    });
    expect(saveWorkflow.mock.calls[0]?.[0]).toMatchObject({ mode: 'quick' });
  });

  test('opens the converted Workflow in the Detailed editor after synchronization', async () => {
    const user = userEvent.setup();
    const quick = createWorkflow({
      mode: 'quick',
      id: 'quick-convert',
      name: 'Quick conversion',
      configuration: {
        cycleCount: 1,
        focus: { durationSeconds: 1_500, environment: {} },
        shortBreak: { durationSeconds: 300, environment: {} },
      },
    });
    if (quick.mode !== 'quick') throw new Error('Expected Quick Workflow.');
    let workflows: readonly Workflow[] = [quick];
    const load = vi.fn(() =>
      Promise.resolve({ workflows, assets: [], settings: defaultSettings }),
    );
    const convertQuickWorkflow = vi.fn(
      (input: Extract<CreateWorkflowInput, { mode: 'quick' }>) => {
        workflows = [
          createWorkflow({
            mode: 'detailed',
            id: input.id,
            name: input.name,
            phases: quick.phases,
          }),
        ];
        return Promise.resolve();
      },
    );
    const synchronizeWorkflowConversion = vi.fn(() => Promise.resolve());
    render(
      <WorkflowStudio
        dependencies={dependencies({
          load,
          convertQuickWorkflow,
          synchronizeWorkflowConversion,
        })}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Convert to detailed' }),
    );
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(
      await screen.findByRole('heading', { name: 'Quick conversion' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Phase 1 name')).toBeVisible();
    expect(convertQuickWorkflow).toHaveBeenCalledOnce();
    expect(synchronizeWorkflowConversion).toHaveBeenCalledOnce();
  });

  test('protects a dirty Quick draft when switching Studio sections', async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio dependencies={dependencies()} />);
    await user.click(
      await screen.findByRole('button', { name: 'Create workflow' }),
    );
    await user.click(screen.getByRole('button', { name: 'Quick setup' }));
    await user.type(screen.getByLabelText('Workflow name'), 'Unsaved');
    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    expect(
      screen.getByRole('dialog', { name: 'Discard changes?' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByRole('heading', { name: 'Quick setup' })).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Assets' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('heading', { name: 'Local Assets' })).toBeVisible();
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
        await screen.findByRole('button', { name: 'Back to workflows' }),
      );
      await user.click(
        await screen.findByRole('button', { name: 'New workflow' }),
      );
      await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
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
        ...preferences.getSnapshot(),
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
    expect(
      screen.getByRole('tablist', { name: 'Configuration' }),
    ).toHaveAttribute('aria-orientation', 'vertical');
    expect(workflowsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Workflows' })).toBeVisible();

    workflowsTab.focus();
    await user.keyboard('{ArrowDown}');

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

  test('uses horizontal arrows for the narrow tablist', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(max-width: 52rem)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const { unmount } = render(
      <WorkflowStudio dependencies={dependencies()} />,
    );

    const workflowsTab = await screen.findByRole('tab', { name: 'Workflows' });
    expect(
      screen.getByRole('tablist', { name: 'Configuration' }),
    ).toHaveAttribute('aria-orientation', 'horizontal');
    workflowsTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Assets' })).toHaveFocus();

    unmount();
    vi.unstubAllGlobals();
  });

  test('activates the Settings tab by click', async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio dependencies={dependencies()} />);

    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(screen.getByRole('tabpanel', { name: 'Settings' })).toBeVisible();
  });

  test('falls back to the first Workflow when the saved selection is unavailable', async () => {
    const user = userEvent.setup();
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

    expect(await screen.findByLabelText('Workflow name')).toHaveValue('First');
    await user.click(screen.getByRole('button', { name: 'Back to workflows' }));
    expect(
      screen.getByRole('button', { name: 'Open First' }).closest('li'),
    ).toHaveAttribute('aria-current', 'true');
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
    await user.click(screen.getByRole('button', { name: 'Detailed setup' }));
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
