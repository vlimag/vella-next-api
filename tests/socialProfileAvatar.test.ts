import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { ensureSocialProfile } from '../lib/social';
import { buildAvatarStoragePath } from '../lib/profileAvatar';

describe('social profile avatars', () => {
  it('loads avatar_url with an existing social profile', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const ownerSecret = 'server-only-test-secret';
    const bucket = 'faith-harbor-profile-avatars';
    const avatarPath = buildAvatarStoragePath('image/webp', userId, ownerSecret, () => 'avatar');
    const avatarUrl = `https://example.supabase.co/storage/v1/object/public/${bucket}/${avatarPath}`;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = ownerSecret;
    process.env.SUPABASE_PROFILE_AVATARS_BUCKET = bucket;
    const maybeSingle = vi.fn(async () => ({
      data: {
        user_id: userId,
        handle: 'vella_member',
        display_name: 'Vella member',
        avatar_url: avatarUrl,
      },
      error: null,
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const supabase = { from: vi.fn(() => ({ select })) };

    const profile = await ensureSocialProfile(
      supabase as never,
      userId,
    );

    expect(select).toHaveBeenCalledWith('user_id, handle, display_name, avatar_url');
    expect(profile.avatar_url).toBe(avatarUrl);
  });

  it('returns the profile avatar immediately after creating a feed post', () => {
    const route = fs.readFileSync(
      path.resolve(import.meta.dirname, '../app/api/v1/feed/posts/route.ts'),
      'utf8',
    );

    expect(route).toContain('avatar_url: profile.avatar_url ?? null');
  });
});
