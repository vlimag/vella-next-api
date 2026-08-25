import { handleLinkAttributionRequest } from '@/lib/acquisitionAttribution';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { fail } from '@/lib/http';

export async function POST(request: Request) {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);
  return handleLinkAttributionRequest(request, auth.userId);
}
