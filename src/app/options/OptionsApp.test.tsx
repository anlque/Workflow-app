import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { defaultSettings } from '@/features/settings';
import {
  createWorkflow,
  type CreateWorkflowInput,
  type Workflow,
} from '@/features/workflow';

import { OptionsApp, type OptionsDependencies } from './OptionsApp';

function dependencies(): OptionsDependencies {
  return {
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
  test('provides a keyboard-operable three-tab workspace', async () => {
    const user = userEvent.setup();
    render(<OptionsApp dependencies={dependencies()} />);

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
