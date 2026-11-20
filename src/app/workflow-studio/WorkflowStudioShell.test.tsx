import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { WorkflowStudioShell } from './WorkflowStudioShell';

describe('WorkflowStudioShell', () => {
  test('owns the branded rail, contextual banner and main landmark', () => {
    render(
      <WorkflowStudioShell
        workflowCount={6}
        assetCount={12}
        topBar={<strong>Workflow Studio</strong>}
        railContext={<button type="button">Switch workflow</button>}
        navigation={(_orientation, counts) => (
          <button type="button">
            Workflows {counts.workflowCount} Assets {counts.assetCount}
          </button>
        )}
      >
        <p>Editor</p>
      </WorkflowStudioShell>,
    );

    const brand = screen.getByText('Locusora', {
      selector: '.workflow-studio-shell__brand-name',
    });
    expect(
      screen.getByRole('complementary', {
        name: 'Workflow Studio navigation',
      }),
    ).toBeVisible();
    const navigation = screen.getByRole('navigation', {
      name: 'Studio sections',
    });
    const banner = screen.getByRole('banner');
    const main = screen.getByRole('main');
    expect(brand).toBeVisible();
    expect(screen.getByText('WORKSPACE')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Switch workflow' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Workflows 6 Assets 12' }),
    ).toBeVisible();
    expect(banner).toHaveTextContent('Workflow Studio');
    expect(banner).not.toHaveClass('app-header');
    expect(navigation).toBeVisible();
    expect(main).toHaveTextContent('Editor');
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
    expect(
      brand.compareDocumentPosition(navigation) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      navigation.compareDocumentPosition(banner) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('keeps navigation before content in keyboard order', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowStudioShell
        workflowCount={0}
        assetCount={0}
        topBar={<span>Workflow Studio</span>}
        railContext={null}
        navigation={() => <button type="button">Assets</button>}
      >
        <button type="button">Create workflow</button>
      </WorkflowStudioShell>,
    );

    await user.tab();
    expect(screen.getByRole('button', { name: 'Assets' })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Create workflow' }),
    ).toHaveFocus();
  });

  test('reports horizontal navigation only at the narrow breakpoint', () => {
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(max-width: 52rem)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const { unmount } = render(
      <WorkflowStudioShell
        workflowCount={0}
        assetCount={0}
        topBar={<span>Workflow Studio</span>}
        railContext={null}
        navigation={(orientation) => <span>{orientation}</span>}
      >
        Editor
      </WorkflowStudioShell>,
    );

    expect(screen.getByText('horizontal')).toBeVisible();
    unmount();
    expect(removeEventListener).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
