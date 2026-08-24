import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserIdFromAuthHeader: vi.fn(),
  createServiceClient: vi.fn(),
  removeUserFeedMedia: vi.fn(),
  removeUserProfileAvatar: vi.fn(),
  deleteUserApplicationData: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromAuthHeader: mocks.getUserIdFromAuthHeader,
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/accountDeletion', () => ({
  removeUserFeedMedia: mocks.removeUserFeedMedia,
  removeUserProfileAvatar: mocks.removeUserProfileAvatar,
  deleteUserApplicationData: mocks.deleteUserApplicationData,
}));

import { DELETE } from '@/app/api/v1/me/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('account deletion route', () => {
  beforeEach(() => {
    mocks.getUserIdFromAuthHeader.mockReset().mockResolvedValue({ userId: USER_ID });
    mocks.removeUserFeedMedia.mockReset().mockResolvedValue({ removed: 0 });
    mocks.removeUserProfileAvatar.mockReset().mockResolvedValue({ removed: 0 });
    mocks.deleteUserApplicationData.mockReset().mockResolvedValue({});
  });

  it('deletes Vella app data without deleting the shared auth identity', async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const supabase = { auth: { admin: { deleteUser } } };
    mocks.createServiceClient.mockReset().mockReturnValue(supabase);

    const response = await DELETE();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { deleted: true } });
    expect(mocks.removeUserFeedMedia).toHaveBeenCalledWith(supabase, USER_ID);
    expect(mocks.removeUserProfileAvatar).toHaveBeenCalledWith(supabase, USER_ID);
    expect(mocks.deleteUserApplicationData).toHaveBeenCalledWith(supabase, USER_ID);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('does not report success when Vella data cleanup fails', async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    mocks.createServiceClient.mockReset().mockReturnValue({ auth: { admin: { deleteUser } } });
    mocks.deleteUserApplicationData.mockResolvedValue({ error: 'database unavailable' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await DELETE();

    expect(response.status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
