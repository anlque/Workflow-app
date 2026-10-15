import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { assetRoleKey, createAssetRole } from '@/features/assets';

import { starterAssetSeeds } from './starterAssetSeeds';

const publicRoot = resolve(import.meta.dirname, '../../../public');

const readUint24LE = (bytes: Buffer, offset: number): number =>
  bytes.readUInt8(offset) |
  (bytes.readUInt8(offset + 1) << 8) |
  (bytes.readUInt8(offset + 2) << 16);

const readWebpSize = (
  bytes: Buffer,
): Readonly<{ width: number; height: number }> => {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');

  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }

  if (chunk === 'VP8 ') {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }

  throw new Error(`Unsupported WebP chunk ${chunk}.`);
};

const readOpusMetadata = (
  bytes: Buffer,
): Readonly<{
  channels: number;
  durationSeconds: number;
  sampleRate: number;
}> => {
  const opusHead = bytes.indexOf(Buffer.from('OpusHead'));
  expect(opusHead).toBeGreaterThanOrEqual(0);
  const preSkip = bytes.readUInt16LE(opusHead + 10);

  let lastGranule = 0n;
  let offset = 0;
  while (offset + 27 <= bytes.length) {
    expect(bytes.toString('ascii', offset, offset + 4)).toBe('OggS');
    lastGranule = bytes.readBigUInt64LE(offset + 6);
    const segmentCount = bytes.readUInt8(offset + 26);
    let payloadLength = 0;
    for (let index = 0; index < segmentCount; index += 1) {
      payloadLength += bytes.readUInt8(offset + 27 + index);
    }
    offset += 27 + segmentCount + payloadLength;
  }

  return {
    channels: bytes.readUInt8(opusHead + 9),
    durationSeconds: Number(lastGranule - BigInt(preSkip)) / 48_000,
    sampleRate: 48_000,
  };
};

describe('starterAssetSeeds', () => {
  it('defines exactly five backgrounds and three ambient loops', () => {
    expect(
      starterAssetSeeds.filter(({ kind }) => kind === 'image'),
    ).toHaveLength(5);
    expect(
      starterAssetSeeds.filter(({ kind }) => kind === 'audio'),
    ).toHaveLength(3);
  });

  it.each(['key', 'name', 'role', 'path'] as const)(
    'has unique %s values',
    (field) => {
      const values = starterAssetSeeds.map((seed) =>
        field === 'role'
          ? assetRoleKey(createAssetRole(seed.role))
          : seed[field],
      );

      expect(new Set(values).size).toBe(values.length);
    },
  );

  it('uses immutable local definitions with matching kinds and MIME types', () => {
    expect(Object.isFrozen(starterAssetSeeds)).toBe(true);

    for (const seed of starterAssetSeeds) {
      expect(Object.isFrozen(seed)).toBe(true);
      expect(seed.path).toMatch(
        /^\/seed\/(backgrounds|audio)\/[a-z0-9-]+\.(webp|ogg)$/u,
      );
      expect(seed.path).not.toMatch(/^https?:/u);
      expect(seed.mimeType).toBe(
        seed.kind === 'image' ? 'image/webp' : 'audio/ogg',
      );
    }
  });

  it('matches the metadata of every packaged file', () => {
    for (const seed of starterAssetSeeds) {
      const bytes = readFileSync(resolve(publicRoot, seed.path.slice(1)));

      if (seed.kind === 'image') {
        expect(readWebpSize(bytes)).toEqual({ width: 2560, height: 1600 });
        expect(bytes.length).toBeLessThanOrEqual(300 * 1024);
      } else {
        const metadata = readOpusMetadata(bytes);
        expect(metadata.channels).toBe(2);
        expect(metadata.sampleRate).toBe(48_000);
        expect(metadata.durationSeconds).toBeCloseTo(30, 2);
      }
    }
  });
});
