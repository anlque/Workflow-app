import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  test.each([
    ['image', 'image/png,image/jpeg,image/webp'],
    ['audio', 'audio/mpeg,audio/ogg,audio/wav'],
  ] as const)('offers a kind-specific %s upload', (kind, accept) => {
    render(
      <AssetPicker
        label={kind === 'image' ? 'Background image' : 'Ambient audio'}
        kind={kind}
        assets={[]}
        onChange={() => undefined}
        onUpload={() => Promise.resolve(kind === 'image' ? image : audio)}
        onSynchronizeUpload={() => Promise.resolve()}
      />,
    );

    expect(screen.getByLabelText(`Upload ${kind}`)).toHaveAttribute(
      'accept',
      accept,
    );
  });

  test('selects a committed upload directly and prevents parallel submissions', async () => {
    let finish!: (asset: typeof image) => void;
    const upload = vi.fn(
      () =>
        new Promise<typeof image>((resolve) => {
          finish = resolve;
        }),
    );
    const synchronize = vi.fn(() => Promise.resolve());
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Background image"
        kind="image"
        assets={[]}
        onChange={onChange}
        onUpload={upload}
        onSynchronizeUpload={synchronize}
      />,
    );
    const input = screen.getByLabelText('Upload image');
    const file = new File(['image'], 'forest.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(input).toBeDisabled();

    finish(image);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        type: 'direct',
        assetId: image.id,
      });
    });
    expect(synchronize).toHaveBeenCalledTimes(1);
  });

  test('reports a pre-commit failure without changing selection or synchronizing', async () => {
    const onChange = vi.fn();
    const synchronize = vi.fn(() => Promise.resolve());
    render(
      <AssetPicker
        label="Ambient audio"
        kind="audio"
        assets={[]}
        onChange={onChange}
        onUpload={() => Promise.reject(new Error('Unsupported audio.'))}
        onSynchronizeUpload={synchronize}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText('Upload audio'),
      new File(['audio'], 'noise.mp3', { type: 'audio/mpeg' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsupported audio.',
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(synchronize).not.toHaveBeenCalled();
  });

  test('retries post-commit synchronization without uploading again', async () => {
    const user = userEvent.setup();
    const upload = vi.fn(() => Promise.resolve(image));
    const synchronize = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Catalog refresh failed.'))
      .mockResolvedValueOnce();
    const onChange = vi.fn();
    render(
      <AssetPicker
        label="Background image"
        kind="image"
        assets={[]}
        onChange={onChange}
        onUpload={upload}
        onSynchronizeUpload={synchronize}
      />,
    );

    await user.upload(
      screen.getByLabelText('Upload image'),
      new File(['image'], 'forest.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Asset was added, but the catalog could not be refreshed.',
    );
    await user.click(screen.getByRole('button', { name: 'Retry sync' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Retry sync' })).toBeNull();
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(synchronize).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
