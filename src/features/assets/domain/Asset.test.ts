import { describe, expect, test } from 'vitest';

import { assetRoleKey, createAsset, createAssetRole } from './Asset';

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

  test('normalizes a Role while preserving meaningful case', () => {
    const role = createAssetRole('  Ｆav\t\nFocus  ');

    expect(role).toBe('Fav Focus');
    expect(assetRoleKey(role)).toBe('fav focus');
  });

  test('uses the same canonical key for case-insensitive Role variants', () => {
    expect(assetRoleKey(createAssetRole('FOCUS'))).toBe(
      assetRoleKey(createAssetRole('focus')),
    );
  });

  test('accepts 64 Role code points and rejects empty or longer Roles', () => {
    expect(createAssetRole('🙂'.repeat(64))).toBe('🙂'.repeat(64));
    expect(() => createAssetRole('\u3000\t')).toThrow('must not be empty');
    expect(() => createAssetRole('🙂'.repeat(65))).toThrow('64');
  });

  test('stores the normalized display Role on an Asset', () => {
    const asset = createAsset({ ...validInput, role: '  Deep\tWork ' });

    expect(asset.role).toBe('Deep Work');
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
