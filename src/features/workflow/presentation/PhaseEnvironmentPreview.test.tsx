import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole } from '@/features/assets';

import { PhaseEnvironmentPreview } from './PhaseEnvironmentPreview';

const directImage = createAsset({
  id: 'direct-image',
  name: 'Forest clearing',
  kind: 'image',
  mimeType: 'image/webp',
  byteSize: 12,
  createdAt: 1,
});

const roleImage = createAsset({
  id: 'role-image',
  name: 'Night garden',
  kind: 'image',
  mimeType: 'image/webp',
  byteSize: 12,
  createdAt: 2,
  role: 'Evening scene',
});

const roleAudio = createAsset({
  id: 'role-audio',
  name: 'Rain',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 12,
  createdAt: 3,
  role: 'Ambient rain',
});
const roleImageName = createAssetRole('Evening scene');
const roleAudioName = createAssetRole('Ambient rain');

describe('PhaseEnvironmentPreview', () => {
  test('renders an unsaved direct background and metadata without audio playback', async () => {
    const loadBlob = vi.fn(() => Promise.resolve(new Blob(['image'])));
    const createObjectUrl = vi.fn(() => 'blob:phase-preview');
    const revokeObjectUrl = vi.fn();
    const view = render(
      <PhaseEnvironmentPreview
        phaseName="Writing"
        phasePosition={2}
        totalPhases={4}
        phaseType="focus"
        durationMinutes="25"
        backgroundColor="#123456"
        backgroundAsset={{ type: 'direct', assetId: directImage.id }}
        audioAsset={{ type: 'role', role: roleAudioName }}
        assets={[directImage, roleAudio]}
        loadBlob={loadBlob}
        createObjectUrl={createObjectUrl}
        revokeObjectUrl={revokeObjectUrl}
      />,
    );

    expect(screen.getByRole('region', { name: 'Writing preview' })).toHaveStyle(
      'background-color: rgb(18, 52, 86)',
    );
    expect(screen.getByText('Phase 2 of 4')).toBeVisible();
    expect(screen.getByText('Focus')).toHaveClass(
      'phase-environment-preview__type',
    );
    expect(screen.getByText('25 min')).toHaveClass(
      'phase-environment-preview__duration',
    );
    expect(screen.getByText('Ambient: Rain')).toBeVisible();
    const preview = screen.getByRole('region', { name: 'Writing preview' });
    expect(
      within(preview)
        .getByText('Phase 2 of 4')
        .compareDocumentPosition(
          within(preview).getByRole('heading', { name: 'Writing' }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(preview.lastElementChild).toHaveClass(
      'phase-environment-preview__meta',
    );
    expect(screen.queryByRole('audio')).toBeNull();
    expect(await screen.findByAltText('Forest clearing')).toHaveAttribute(
      'src',
      'blob:phase-preview',
    );
    expect(loadBlob).toHaveBeenCalledWith(directImage.id);

    view.unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:phase-preview');
  });

  test('resolves Role images and replaces the owned URL when the draft changes', async () => {
    const loadBlob = vi.fn(() => Promise.resolve(new Blob(['image'])));
    const createObjectUrl = vi
      .fn()
      .mockReturnValueOnce('blob:role')
      .mockReturnValueOnce('blob:direct');
    const revokeObjectUrl = vi.fn();
    const common = {
      phaseName: 'Focus',
      phasePosition: 1,
      totalPhases: 2,
      phaseType: 'focus' as const,
      durationMinutes: '25',
      backgroundColor: '',
      audioAsset: undefined,
      assets: [directImage, roleImage],
      loadBlob,
      createObjectUrl,
      revokeObjectUrl,
    };
    const view = render(
      <PhaseEnvironmentPreview
        {...common}
        backgroundAsset={{ type: 'role', role: roleImageName }}
      />,
    );
    expect(await screen.findByAltText('Night garden')).toBeVisible();

    view.rerender(
      <PhaseEnvironmentPreview
        {...common}
        backgroundAsset={{ type: 'direct', assetId: directImage.id }}
      />,
    );

    expect(await screen.findByAltText('Forest clearing')).toHaveAttribute(
      'src',
      'blob:direct',
    );
    await waitFor(() => {
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:role');
    });
  });

  test('shows a stable fallback for unavailable or wrong-kind references', () => {
    render(
      <PhaseEnvironmentPreview
        phaseName="Break"
        phasePosition={1}
        totalPhases={1}
        phaseType="break"
        durationMinutes="5"
        backgroundColor=""
        backgroundAsset={{ type: 'role', role: roleAudioName }}
        audioAsset={undefined}
        assets={[roleAudio]}
        loadBlob={() => Promise.resolve(null)}
        createObjectUrl={() => 'unused'}
        revokeObjectUrl={() => undefined}
      />,
    );

    expect(screen.getByText('Background preview unavailable')).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
