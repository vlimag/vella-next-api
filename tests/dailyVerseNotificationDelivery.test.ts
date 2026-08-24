import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureDailyVersesForDay: vi.fn(),
  getExpoPushReceipts: vi.fn(),
  sendExpoPushMessages: vi.fn(),
}));

vi.mock('@/lib/dailyVerse', () => ({
  ensureDailyVersesForDay: mocks.ensureDailyVersesForDay,
}));

vi.mock('@/lib/expoPush', () => ({
  getExpoPushReceipts: mocks.getExpoPushReceipts,
  sendExpoPushMessages: mocks.sendExpoPushMessages,
}));

import {
  sendDueDailyVerseNotifications,
  type DueDailyVerseNotification,
} from '@/lib/dailyVerseNotifications';

type PushToken = { id: string; user_id: string; expo_push_token: string };

type DailyVerseRow = {
  verse_id: string;
  bible_verses: {
    id: string;
    text_content: string;
    chapter: number;
    verse: number;
    bible_books: { code: string };
    bible_versions: { is_active: true };
  };
};

class FakeNotificationDatabase {
  readonly inserts: Array<Record<string, unknown>> = [];
  readonly updates: Array<{ table: string; values: Record<string, unknown>; column: string; value: unknown }> = [];
  readonly dailyRows = new Map<string, DailyVerseRow>();
  readonly dailyLookupErrors = new Set<string>();

  constructor(readonly tokens: PushToken[]) {}

  from(table: string) {
    if (table === 'user_push_tokens') return this.pushTokensQuery();
    if (table === 'daily_verses') return this.dailyVersesQuery();
    if (table === 'daily_verse_notification_deliveries') return this.deliveriesQuery();
    throw new Error(`Unexpected table in test: ${table}`);
  }

  private pushTokensQuery() {
    const query = {
      select: () => query,
      eq: () => query,
      in: async () => ({ data: this.tokens, error: null }),
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          this.updates.push({ table: 'user_push_tokens', values, column, value });
          return { error: null };
        },
      }),
    };
    return query;
  }

  private dailyVersesQuery() {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      limit: () => query,
      maybeSingle: async () => {
        const key = `${String(filters.day)}:${String(filters.language_code)}`;
        if (this.dailyLookupErrors.has(key)) {
          return { data: null, error: { message: 'simulated lookup failure' } };
        }
        return { data: this.dailyRows.get(key) ?? null, error: null };
      },
    };
    return query;
  }

  private deliveriesQuery() {
    return {
      insert: (values: Record<string, unknown>) => {
        this.inserts.push(values);
        return {
          select: () => ({
            single: async () => ({
              data: { id: `delivery-${this.inserts.length}` },
              error: null,
            }),
          }),
        };
      },
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          this.updates.push({
            table: 'daily_verse_notification_deliveries',
            values,
            column,
            value,
          });
          return { error: null };
        },
      }),
    };
  }
}

function due(overrides: Partial<DueDailyVerseNotification> = {}): DueDailyVerseNotification {
  return {
    user_id: '00000000-0000-4000-8000-000000000001',
    slot: 1,
    local_day: '2026-08-04',
    language_code: 'pt',
    reminder_style: 'scripture',
    goal: 'habit',
    focus: null,
    ...overrides,
  };
}

function verseRow(): DailyVerseRow {
  return {
    verse_id: '10000000-0000-4000-8000-000000000001',
    bible_verses: {
      id: '10000000-0000-4000-8000-000000000001',
      text_content: 'O Senhor é o meu pastor; nada me faltará.',
      chapter: 23,
      verse: 1,
      bible_books: { code: 'PSA' },
      bible_versions: { is_active: true },
    },
  };
}

describe('daily verse notification delivery pipeline', () => {
  beforeEach(() => {
    mocks.ensureDailyVersesForDay.mockReset().mockResolvedValue({ generated: 0, provider: 'cache' });
    mocks.getExpoPushReceipts.mockReset();
    mocks.sendExpoPushMessages.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the shared daily verse, claims the delivery and stores the Expo ticket', async () => {
    const database = new FakeNotificationDatabase([
      {
        id: '20000000-0000-4000-8000-000000000001',
        user_id: due().user_id,
        expo_push_token: 'ExponentPushToken[test-token-value]',
      },
    ]);
    database.dailyRows.set('2026-08-04:pt', verseRow());
    mocks.sendExpoPushMessages.mockResolvedValue([{ status: 'ok', id: 'expo-ticket-1' }]);

    const result = await sendDueDailyVerseNotifications(database as never, [due()]);

    expect(mocks.ensureDailyVersesForDay).toHaveBeenCalledWith(database, '2026-08-04');
    expect(mocks.sendExpoPushMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[test-token-value]',
        body: expect.stringContaining('O Senhor é o meu pastor'),
        data: expect.objectContaining({
          verseId: '10000000-0000-4000-8000-000000000001',
        }),
      }),
    ]);
    expect(database.inserts).toEqual([
      expect.objectContaining({
        verse_id: '10000000-0000-4000-8000-000000000001',
        local_day: '2026-08-04',
        slot: 1,
      }),
    ]);
    expect(database.updates).toContainEqual(expect.objectContaining({
      table: 'daily_verse_notification_deliveries',
      values: { status: 'accepted', expo_ticket_id: 'expo-ticket-1' },
    }));
    expect(result).toMatchObject({ due: 1, claimed: 1, accepted: 1, failed: 0 });
  });

  it('skips safely and never calls Expo when neither a localized nor English daily verse exists', async () => {
    const database = new FakeNotificationDatabase([
      {
        id: '20000000-0000-4000-8000-000000000001',
        user_id: due().user_id,
        expo_push_token: 'ExponentPushToken[test-token-value]',
      },
    ]);

    const result = await sendDueDailyVerseNotifications(database as never, [due()]);

    expect(mocks.sendExpoPushMessages).not.toHaveBeenCalled();
    expect(database.inserts).toHaveLength(0);
    expect(result).toMatchObject({
      due: 1,
      claimed: 0,
      skipped: { noVerse: 1, verseLookupFailed: 0 },
    });
  });

  it('records and logs a sanitized lookup failure without claiming or sending', async () => {
    const database = new FakeNotificationDatabase([
      {
        id: '20000000-0000-4000-8000-000000000001',
        user_id: due().user_id,
        expo_push_token: 'ExponentPushToken[test-token-value]',
      },
    ]);
    database.dailyLookupErrors.add('2026-08-04:pt');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await sendDueDailyVerseNotifications(database as never, [due()]);

    expect(errorSpy).toHaveBeenCalledWith(
      '[daily-verse-notifications] verse_lookup_failed',
      expect.objectContaining({ localDay: '2026-08-04', language: 'pt' }),
    );
    expect(errorSpy.mock.calls[0]?.[1]).not.toHaveProperty('userId');
    expect(errorSpy.mock.calls[0]?.[1]).not.toHaveProperty('pushToken');
    expect(mocks.sendExpoPushMessages).not.toHaveBeenCalled();
    expect(database.inserts).toHaveLength(0);
    expect(result.skipped.verseLookupFailed).toBe(1);
  });
});
