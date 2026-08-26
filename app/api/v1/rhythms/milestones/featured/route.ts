import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { replaceFeaturedMilestones, type MilestoneClient } from '@/lib/rhythms/milestones';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  codes: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)).max(3),
}).strict().superRefine((value, context) => {
  if (new Set(value.codes).size !== value.codes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['codes'], message: 'Codes must be unique' });
  }
});

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function PUT(request: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return noStore(fail('Invalid milestone selection', 400, { code: 'invalid_featured_milestones' }));
  }

  const client = createServiceClient() as unknown as MilestoneClient;
  const result = await replaceFeaturedMilestones(client, access.userId, parsed.data.codes);
  if (result.ok) return noStore(ok(result.value));
  if (result.code === 'invalid_milestone') {
    return noStore(fail('One or more milestones cannot be featured', 400, {
      code: 'invalid_featured_milestone',
    }));
  }
  console.error('[rhythms-milestones]', {
    route: 'featured_milestones', stage: 'replace', code: 'database_unavailable',
  });
  return noStore(fail('Could not update featured milestones', 503, { code: 'milestones_unavailable' }));
}
