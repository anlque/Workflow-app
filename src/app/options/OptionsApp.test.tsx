import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { defaultSettings } from '@/features/settings';
import { createAsset } from '@/features/assets';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';

import type { WorkflowStudioDependencies } from '../workflow-studio/WorkflowStudio';
import { OptionsApp } from './OptionsApp';

const renderWorkflowStudio = vi.fn(
  (dependencies: WorkflowStudioDependencies, onNavigateToFocus: () => void) => {
    void dependencies;
    void onNavigateToFocus;
    return <p>Shared Workflow Studio</p>;
  },
);

vi.mock('../workflow-studio/WorkflowStudio', () => ({
  WorkflowStudio: ({
    dependencies,
    onNavigateToFocus,
  }: Readonly<{
    dependencies: WorkflowStudioDependencies;
    onNavigateToFocus: () => void;
  }>) => renderWorkflowStudio(dependencies, onNavigateToFocus),
}));

function dependencies(): WorkflowStudioDependencies {
  return {
    preferences: createTestDocumentPreferences(),
    load: () =>
      Promise.resolve({ workflows: [], assets: [], settings: defaultSettings }),
    saveWorkflow: () => Promise.resolve(),
    convertQuickWorkflow: () => Promise.resolve(),
    synchronizeWorkflowConversion: () => Promise.resolve(),
    duplicateWorkflow: () => Promise.resolve(),
    deleteWorkflow: () => Promise.resolve(),
    reorderWorkflows: () => Promise.resolve(),
    importAsset: (_file, kind) =>
      Promise.resolve(
        createAsset({
          id: `options-${kind}`,
          name: kind,
          kind,
          mimeType: kind === 'image' ? 'image/png' : 'audio/mpeg',
          byteSize: 1,
          createdAt: 1,
        }),
      ),
    synchronizeAssetImport: () => Promise.resolve(),
    inspectAssetRetirement: () => Promise.reject(new Error('Not used.')),
    retireAsset: () => Promise.resolve(),
    synchronizeAssetRetirement: () => Promise.resolve(),
    createAssetRetirementUploadInput: (file, kind) => ({
      id: 'replacement-id',
      name: file.name,
      kind,
      blob: file,
      createdAt: 1,
    }),
    inspectAssetRoleChange: () => Promise.reject(new Error('Not used.')),
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
  };
}

describe('OptionsApp', () => {
  test('delegates the fallback options page to WorkflowStudio', () => {
    const deps = dependencies();
    const navigateToFocus = vi.fn();

    render(
      <OptionsApp dependencies={deps} onNavigateToFocus={navigateToFocus} />,
    );

    expect(screen.getByText('Shared Workflow Studio')).toBeVisible();
    expect(renderWorkflowStudio).toHaveBeenCalledWith(deps, navigateToFocus);
  });
});
