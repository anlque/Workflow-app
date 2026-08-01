import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { defaultSettings } from '@/features/settings';

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
