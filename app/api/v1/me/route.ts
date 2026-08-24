import { NextResponse } from 'next/server';
import { fail } from '@/lib/http';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase';
import {
  deleteUserApplicationData,
  removeUserFeedMedia,
  removeUserProfileAvatar,
} from '@/lib/accountDeletion';

/**
 * Delete the authenticated user's account (Apple Guideline 5.1.1(v) requires
 * in-app account deletion for apps that let users create an account).
 *
 * The Supabase Auth project is shared across products, so Vella deletes only
 * its own application rows. Deleting or soft-deleting the shared Auth user
 * would disable the same login in other products and prevent a later OAuth
 * sign-in from creating a fresh Vella account. Billing/receipt rows keep a
 * null user_id so financial records survive for audit/refunds without being
 * linked to the deleted Vella account.
 */
export async function DELETE() {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const supabase = createServiceClient();
  const avatarCleanup = await removeUserProfileAvatar(supabase, auth.userId);
  if (avatarCleanup.error) {
    console.error('[account-deletion] avatar_cleanup_failed', {
      error: avatarCleanup.error,
    });
    return fail('Failed to delete profile image', 500);
  }

  const mediaCleanup = await removeUserFeedMedia(supabase, auth.userId);
  if (mediaCleanup.error) {
    console.error('[account-deletion] media_cleanup_failed', {
      error: mediaCleanup.error,
    });
    return fail('Failed to delete account media', 500);
  }

  const dataCleanup = await deleteUserApplicationData(supabase, auth.userId);
  if (dataCleanup.error) {
    console.error('[account-deletion] data_cleanup_failed', {
      error: dataCleanup.error,
    });
    return fail('Failed to delete account data', 500);
  }

  return NextResponse.json({ data: { deleted: true } });
}
