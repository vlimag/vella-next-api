import { ok } from '@/lib/http';
import { ingestGrowthEvents } from '@/lib/growthAnalytics';

export async function POST(req: Request) {
  const result = await ingestGrowthEvents(req);
  if ('response' in result) return result.response;

  return ok(result.data, {
    status: 202,
    headers: { 'Cache-Control': 'no-store' },
  });
}
