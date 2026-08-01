import { describe, expect, test } from 'vitest';

import { createAsset } from './Asset';

const validInput = {
  id: 'asset-1',
  name: 'Rain',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 42,
  createdAt: 1_000,
} as const;

describe('Asset', () => {
  test('creates immutable validated metadata', () => {
    const asset = createAsset(validInput);

    expect(asset).toEqual(validInput);
    expect(Object.isFrozen(asset)).toBe(true);
  });

  test.each([
    [{ ...validInput, id: ' ' }, 'identifier'],
    [{ ...validInput, name: ' ' }, 'name'],
    [{ ...validInput, kind: 'video' }, 'kind'],
    [{ ...validInput, mimeType: '' }, 'MIME'],
    [{ ...validInput, byteSize: 0 }, 'byte size'],
    [{ ...validInput, createdAt: -1 }, 'creation time'],
  ])('rejects invalid metadata %#', (input, message) => {
    expect(() => createAsset(input)).toThrow(message);
  });
});
