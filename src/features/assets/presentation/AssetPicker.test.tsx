import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset } from '../domain/Asset';
import { AssetPicker } from './AssetPicker';

const image = createAsset({
  id: 'image-1',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 10,
  createdAt: 1_000,
});
const audio = createAsset({
  id: 'audio-1',
  name: 'Rain',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 10,
  createdAt: 1_000,
});

describe('AssetPicker', () => {
  test('shows only Assets matching the requested semantic kind', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Background image"
        kind="image"
        assets={[audio, image]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('option', { name: 'Forest' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Rain' })).toBeNull();
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      image.id,
    );

    expect(onChange).toHaveBeenCalledWith(image.id);
  });

  test('maps the empty option to no Asset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Ambient audio"
        kind="audio"
        assets={[audio]}
        value={audio.id}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Ambient audio'), '');
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
