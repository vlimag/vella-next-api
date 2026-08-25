import { handleInstallAttributionRequest } from '@/lib/acquisitionAttribution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Apple's documented early-token retry path can take roughly 25 seconds.
export const maxDuration = 30;

export async function POST(request: Request) {
  return handleInstallAttributionRequest(request);
}
