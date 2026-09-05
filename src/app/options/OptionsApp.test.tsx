import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset } from '@/features/assets';
import { defaultSettings } from '@/features/settings';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';
import {
  createWorkflow,
  type CreateWorkflowInput,
  type Workflow,
} from '@/features/workflow';

import { OptionsApp, type OptionsDependencies } from './OptionsApp';

function dependencies(): OptionsDependencies {
  return {
    preferences: createTestDocumentPreferences(),
    load: () =>
      Promise.resolve({ workflows: [], assets: [], settings: defaultSettings }),
    saveWorkflow: () => Promise.resolve(),
    duplicateWorkflow: () => Promise.resolve(),
    deleteWorkflow: () => Promise.resolve(),
    reorderWorkflows: () => Promise.resolve(),
    importAsset: () => Promise.resolve(),
    deleteAsset: () => Promise.resolve(),
    loadAssetBlob: () => Promise.resolve(null),
    createObjectUrl: () => 'blob:asset',
    revokeObjectUrl: () => undefined,
    updateSettings: () => Promise.resolve(),
    exportSettings: () => Promise.resolve(),
    importSettings: () => Promise.resolve(),
    exportWorkflow: () => Promise.resolve(),
    importWorkflow: () => Promise.resolve(),
    createId: () => 'new-id',
  };
}

describe('OptionsApp', () => {
  test('does not recreate a playing audio preview after importing an image', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
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
    deps.load = vi.fn(() =>
      Promise.resolve({ workflows: [], assets, settings: defaultSettings }),
    );
    deps.loadAssetBlob = vi.fn(() => Promise.resolve(new Blob(['audio'])));
    deps.createObjectUrl = vi.fn(() => 'blob:rain');
    deps.revokeObjectUrl = vi.fn();
    deps.importAsset = vi.fn(() => {
      assets = [audio, image];
      return Promise.resolve();
    });
    render(<OptionsApp dependencies={deps} />);
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
    render(<OptionsApp dependencies={deps} />);
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
    const { container } = render(<OptionsApp dependencies={dependencies()} />);

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
    render(<OptionsApp dependencies={dependencies()} />);

    await user.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(screen.getByRole('tabpanel', { name: 'Settings' })).toBeVisible();
  });

  test('keeps the editor mounted long enough to announce a successful save', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
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
    deps.load = load;
    deps.saveWorkflow = vi.fn((input: CreateWorkflowInput) => {
      workflows = [createWorkflow(input)];
      return Promise.resolve();
    });
    render(<OptionsApp dependencies={deps} />);

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
    const broken = dependencies();
    broken.load = vi.fn(() =>
      Promise.reject(new Error('Database unavailable.')),
    );
    render(<OptionsApp dependencies={broken} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database unavailable.',
    );
  });
});
