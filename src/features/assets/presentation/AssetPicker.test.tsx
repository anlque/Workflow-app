import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole } from '../domain/Asset';
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
const roleImage = createAsset({
  ...image,
  id: 'image-role',
  name: 'Meadow',
  role: 'Hero scene',
});

describe('AssetPicker', () => {
  test('shows only Assets matching the requested semantic kind', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Background image"
        kind="image"
        assets={[audio, image, roleImage]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('option', { name: 'Forest' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Rain' })).toBeNull();
    await user.selectOptions(
      screen.getByLabelText('Background image'),
      `direct:${image.id}`,
    );

    expect(onChange).toHaveBeenCalledWith({
      type: 'direct',
      assetId: image.id,
    });
  });

  test('maps the empty option to no Asset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Ambient audio"
        kind="audio"
        assets={[audio]}
        value={{ type: 'direct', assetId: audio.id }}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Ambient audio'), '');
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test('separates direct and Role references and returns the selected union', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Background"
        kind="image"
        assets={[image, roleImage]}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole('group', { name: 'Choose Asset directly' }),
    ).toBeVisible();
    expect(screen.getByRole('group', { name: 'Follow Role' })).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText('Background'),
      'role:hero scene',
    );
    expect(onChange).toHaveBeenCalledWith({ type: 'role', role: 'Hero scene' });
  });

  test('emits explicit direct, Role and None transitions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Background"
        kind="image"
        assets={[image, roleImage]}
        onChange={onChange}
      />,
    );
    const picker = screen.getByLabelText('Background');
    await user.selectOptions(picker, `direct:${image.id}`);
    await user.selectOptions(picker, 'role:hero scene');
    await user.selectOptions(picker, '');
    expect(onChange).toHaveBeenNthCalledWith(1, {
      type: 'direct',
      assetId: image.id,
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      type: 'role',
      role: 'Hero scene',
    });
    expect(onChange).toHaveBeenNthCalledWith(3, undefined);
  });

  test('preserves a Role selection across equivalent catalog rerenders', () => {
    const value = {
      type: 'role' as const,
      role: createAssetRole('Hero scene'),
    };
    const view = render(
      <AssetPicker
        label="Background"
        kind="image"
        assets={[roleImage]}
        value={value}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Background')).toHaveValue('role:hero scene');
    view.rerender(
      <AssetPicker
        label="Background"
        kind="image"
        assets={[{ ...roleImage }]}
        value={value}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Background')).toHaveValue('role:hero scene');
  });

  test('keeps an unavailable selected Role visible', () => {
    render(
      <AssetPicker
        label="Background"
        kind="image"
        assets={[audio]}
        value={{ type: 'role', role: createAssetRole('Hero scene') }}
        onChange={() => undefined}
      />,
    );
    expect(
      screen.getByRole('option', { name: 'Hero scene — unavailable' }),
    ).toBeVisible();
  });
});
