import { describe, expect, it, vi } from 'vitest';
import {
  decodeGatheringCatalogV2,
  decodeGatheringProgressResultV2,
  loadGatheringCatalogV2,
  saveGatheringProgressInputSchema,
  saveGatheringProgressV2,
} from '@/lib/rhythms/gatheringsV2';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ANONYMOUS_ID = '22222222-2222-4222-8222-222222222222';
const RELEASE_ID = '33333333-3333-4333-8333-333333333333';
const TEMPLATE_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';

const validCatalog = {
  schema_version: 2,
  timezone_name: 'America/Sao_Paulo',
  generated_at: '2026-08-27T03:00:00.000Z',
  featured: [{
    release_id: RELEASE_ID,
    template_id: TEMPLATE_ID,
    catalog_code: 'g-2026w35-mon',
    slot_type: 'monday',
    source_kind: 'generated',
    locale: 'pt',
    title: 'Um descanso atento',
    summary: 'Um encontro guiado para esta semana.',
    theme_key: 'weekly_rest',
    estimated_duration_seconds: 900,
    available_from: '2026-08-24T03:00:00.000Z',
    progress: null,
  }],
  history: [],
  next_release: {
    slot_type: 'thursday',
    available_at: '2026-08-27T03:00:00.000Z',
  },
  fallback_used: false,
};

describe('Gathering v2 contracts and RPC adapters', () => {
  it('decodes a v2 catalog and rejects older or widened payloads', () => {
    expect(decodeGatheringCatalogV2(validCatalog)).toEqual(validCatalog);
    expect(decodeGatheringCatalogV2({ ...validCatalog, schema_version: 1 })).toBeNull();
    expect(decodeGatheringCatalogV2({ ...validCatalog, private_body: 'never return this' })).toBeNull();
  });

  it('allows anonymous catalog ownership while preserving the server response contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: validCatalog, error: null });

    await expect(loadGatheringCatalogV2({ rpc }, {
      userId: ANONYMOUS_ID,
      locale: 'pt',
      timezoneName: 'America/Sao_Paulo',
      now: '2026-08-27T03:00:00.000Z',
    })).resolves.toEqual({ ok: true, value: validCatalog });

    expect(rpc).toHaveBeenCalledWith('get_gathering_catalog_v2', {
      p_owner_user_id: ANONYMOUS_ID,
      p_locale: 'pt',
      p_timezone_name: 'America/Sao_Paulo',
      p_now: '2026-08-27T03:00:00.000Z',
    });
  });

  it('decodes finite account-required progress and never exposes malformed RPC data', () => {
    expect(decodeGatheringProgressResultV2({
      outcome: 'account_required',
      new_milestone_codes: [],
    })).toEqual({ outcome: 'account_required', new_milestone_codes: [] });
    expect(decodeGatheringProgressResultV2({
      outcome: 'database exploded',
      message: 'private database detail',
    })).toBeNull();
  });

  it('requires an idempotency key for completed progress and uses the v2 RPC', async () => {
    expect(saveGatheringProgressInputSchema.safeParse({
      current_step: 8,
      state: 'completed',
      timezone_name: 'UTC',
    }).success).toBe(false);

    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'completed',
        progress: { current_step: 8, status: 'completed' },
        new_milestone_codes: [],
      },
      error: null,
    });

    await expect(saveGatheringProgressV2({ rpc }, {
      userId: USER_ID,
      templateId: TEMPLATE_ID,
      currentStep: 8,
      state: 'completed',
      idempotencyKey: IDEMPOTENCY_KEY,
      timezoneName: 'UTC',
    })).resolves.toEqual({
      ok: true,
      value: {
        outcome: 'completed',
        progress: { current_step: 8, status: 'completed' },
        new_milestone_codes: [],
      },
    });
    expect(rpc).toHaveBeenCalledWith('save_gathering_progress_v2', {
      p_owner_user_id: USER_ID,
      p_template_id: TEMPLATE_ID,
      p_current_step: 8,
      p_state: 'completed',
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_timezone_name: 'UTC',
    });
  });
});
