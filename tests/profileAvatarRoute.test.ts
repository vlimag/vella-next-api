import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

const mocks = vi.hoisted(() => ({
  requireActiveSubscription: vi.fn(),
  ensureSocialProfile: vi.fn(),
  isSocialUserSuspended: vi.fn(),
  moderateSocialAvatarContent: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

vi.mock('@/lib/social', () => ({
  ensureSocialProfile: mocks.ensureSocialProfile,
  isSocialUserSuspended: mocks.isSocialUserSuspended,
}));

vi.mock('@/lib/socialModeration', () => ({
  moderateSocialAvatarContent: mocks.moderateSocialAvatarContent,
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { DELETE, POST } from '@/app/api/v1/feed/me/avatar/route';
import { buildAvatarStoragePath } from '@/lib/profileAvatar';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUPABASE_URL = 'https://example.supabase.co';
const BUCKET = 'faith-harbor-profile-avatars';
const OWNER_SECRET = 'server-only-test-secret';
const PROFILE = {
  user_id: USER_ID,
  handle: 'vella_member',
  display_name: 'Vella member',
  bio: null,
  avatar_url: null,
  allow_mentions: true,
  is_private: false,
  created_at: '2026-08-24T12:00:00.000Z',
  updated_at: '2026-08-24T12:00:00.000Z',
};
let IMAGE_BYTES: Buffer;

function requestBody(mimeType = 'image/jpeg') {
  return new Request('https://vella.one/api/v1/feed/me/avatar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      base64: IMAGE_BYTES.toString('base64'),
      mime_type: mimeType,
      width: 512,
      height: 512,
      file_size: 10,
    }),
  });
}

function createClient(currentAvatarUrl: string | null = null) {
  const upload = vi.fn(async (
    _path: string,
    _bytes: Buffer,
    _options: { contentType: string; upsert: boolean; cacheControl: string },
  ) => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` },
  }));
  const update = vi.fn((payload: { avatar_url: string | null }) => ({
    ...updateQuery(payload),
  }));

  function updateQuery(payload: { avatar_url: string | null }) {
    const query = {
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { ...PROFILE, avatar_url: payload.avatar_url },
          error: null,
        })),
      })),
    };
    return query;
  }

  return {
    upload,
    remove,
    update,
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { avatar_url: currentAvatarUrl }, error: null })),
          })),
        })),
        update,
      })),
      storage: {
        from: vi.fn(() => ({ upload, remove, getPublicUrl })),
      },
    },
  };
}

describe('profile avatar route', () => {
  beforeAll(async () => {
    IMAGE_BYTES = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#776655' },
    }).jpeg().toBuffer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = OWNER_SECRET;
    process.env.SUPABASE_PROFILE_AVATARS_BUCKET = BUCKET;
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.ensureSocialProfile.mockResolvedValue(PROFILE);
    mocks.isSocialUserSuspended.mockResolvedValue(false);
    mocks.moderateSocialAvatarContent.mockResolvedValue({
      allowed: true,
      reason: 'safe',
      tags: [],
      source: 'openai_moderation',
    });
  });

  it('moderates, uploads to an opaque path, and returns the updated profile', async () => {
    const storage = createClient();
    mocks.createServiceClient.mockReturnValue(storage.client);

    const response = await POST(requestBody());

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.avatar_url).toContain(`/storage/v1/object/public/${BUCKET}/`);
    expect(storage.upload).toHaveBeenCalledOnce();
    const [path, bytes, options] = storage.upload.mock.calls[0];
    expect(path).toMatch(/^[a-f0-9-]+\.[a-f0-9]{64}\.webp$/u);
    expect(path).not.toContain(USER_ID);
    expect(bytes).not.toEqual(IMAGE_BYTES);
    expect(options).toMatchObject({ contentType: 'image/webp', upsert: false });
    expect(storage.update).toHaveBeenCalledWith({ avatar_url: payload.data.avatar_url });
  });

  it('accepts JPEG base64 when iOS reports the original HEIC picker metadata', async () => {
    const storage = createClient();
    mocks.createServiceClient.mockReturnValue(storage.client);

    const response = await POST(requestBody('image/heic'));

    expect(response.status).toBe(200);
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(storage.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/webp' });
  });

  it('fails closed when public-image moderation is unavailable', async () => {
    const storage = createClient();
    mocks.createServiceClient.mockReturnValue(storage.client);
    mocks.moderateSocialAvatarContent.mockResolvedValue({
      allowed: false,
      reason: 'Safety checks are temporarily unavailable.',
      tags: ['moderation_unavailable'],
      source: 'unavailable',
    });

    const response = await POST(requestBody());

    expect(response.status).toBe(503);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('removes the previous owned avatar after a successful replacement', async () => {
    const oldPath = buildAvatarStoragePath('image/jpeg', USER_ID, OWNER_SECRET, () => 'old-avatar');
    const oldUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${oldPath}`;
    const storage = createClient(oldUrl);
    mocks.createServiceClient.mockReturnValue(storage.client);

    const response = await POST(requestBody());

    expect(response.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith([oldPath]);
  });

  it('clears the profile before deleting the stored avatar', async () => {
    const oldPath = buildAvatarStoragePath('image/jpeg', USER_ID, OWNER_SECRET, () => 'old-avatar');
    const oldUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${oldPath}`;
    const storage = createClient(oldUrl);
    mocks.createServiceClient.mockReturnValue(storage.client);

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(storage.update).toHaveBeenCalledWith({ avatar_url: null });
    expect(storage.remove).toHaveBeenCalledWith([oldPath]);
  });

  it('never deletes an avatar path signed for another user', async () => {
    const anotherUserId = '22222222-2222-4222-8222-222222222222';
    const foreignPath = buildAvatarStoragePath(
      'image/jpeg',
      anotherUserId,
      OWNER_SECRET,
      () => 'foreign-avatar',
    );
    const foreignUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${foreignPath}`;
    const storage = createClient(foreignUrl);
    mocks.createServiceClient.mockReturnValue(storage.client);

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
