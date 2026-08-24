import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import {
  avatarStoragePathFromPublicUrl,
  avatarStoragePathBelongsToUser,
  buildAvatarStoragePath,
  decodeBase64Avatar,
  detectAvatarMimeType,
  normalizeAvatarImage,
} from '@/lib/profileAvatar';

describe('profile avatar safety', () => {
  it('decodes a valid small image payload and rejects empty or oversized input', () => {
    expect(decodeBase64Avatar(Buffer.from('image-bytes').toString('base64'))).toEqual(Buffer.from('image-bytes'));
    expect(() => decodeBase64Avatar('')).toThrow('invalid');
    expect(() => decodeBase64Avatar(Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64'))).toThrow('4 MB');
  });

  it('uses opaque unique paths that do not expose a user identifier', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const ownerSecret = 'server-only-owner-secret';
    const path = buildAvatarStoragePath('image/jpeg', userId, ownerSecret, () => 'opaque-random-id');

    expect(path).toMatch(/^opaque-random-id\.[a-f0-9]{64}\.jpg$/u);
    expect(path).not.toContain(userId);
    expect(avatarStoragePathBelongsToUser(path, userId, ownerSecret)).toBe(true);
    expect(avatarStoragePathBelongsToUser(
      path,
      '22222222-2222-4222-8222-222222222222',
      ownerSecret,
    )).toBe(false);
  });

  it('detects the encoded image type from bytes instead of trusting picker metadata', () => {
    expect(detectAvatarMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00])))
      .toBe('image/jpeg');
    expect(detectAvatarMimeType(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )).toBe('image/png');
    expect(() => detectAvatarMimeType(Buffer.from('not-an-image'))).toThrow('supported image');
  });

  it('normalizes avatars to a square WebP without source metadata', async () => {
    const source = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#887766' },
    })
      .withMetadata({ exif: { IFD0: { Copyright: 'private metadata' } } })
      .jpeg()
      .toBuffer();

    const normalized = await normalizeAvatarImage(source);
    const metadata = await sharp(normalized.bytes).metadata();

    expect(normalized.mimeType).toBe('image/webp');
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(1024);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it('extracts cleanup paths only from the configured Supabase bucket and origin', () => {
    const origin = 'https://example.supabase.co';
    const bucket = 'faith-harbor-profile-avatars';
    const valid = `${origin}/storage/v1/object/public/${bucket}/opaque%20avatar.jpg`;

    expect(avatarStoragePathFromPublicUrl(valid, origin, bucket)).toBe('opaque avatar.jpg');
    expect(avatarStoragePathFromPublicUrl('https://evil.example/avatar.jpg', origin, bucket)).toBeNull();
    expect(avatarStoragePathFromPublicUrl(
      `${origin}/storage/v1/object/public/another-bucket/avatar.jpg`,
      origin,
      bucket,
    )).toBeNull();
  });
});
