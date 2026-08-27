import { describe, expect, it, vi } from 'vitest';

// The CLI is intentionally plain ESM so it can run directly under Node.
// @ts-expect-error TypeScript has no declaration emitter for this test-only .mjs module.
const modulePromise = import('../scripts/seed-gathering-inventory.mjs');

describe('gatherings inventory seed command', async () => {
  const { parseArgs, run, REVIEWED_EVERGREEN_FALLBACKS } = await modulePromise;

  it('plans a bounded dry run without publishing', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ planned: 12, published: 0 }), { status: 200 }));
    const logs: string[] = [];

    const result = await run(['--dry-run'], {
      fetch,
      apiBaseUrl: 'https://example.test',
      cronSecret: 'secret-not-logged',
      log: (line: string) => logs.push(line),
    });

    expect(result).toMatchObject({ planned: 12, published: 0 });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.test/api/cron/gathering-content',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer secret-not-logged' }),
        body: expect.any(String),
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      dry_run: true,
      max_slots: 12,
      evergreen_fallbacks: REVIEWED_EVERGREEN_FALLBACKS,
    });
    expect(logs.join('\n')).not.toContain('editorial_text');
    expect(logs.join('\n')).not.toContain('secret-not-logged');
  });

  it('applies at most the requested twelve slots', async () => {
    let inventory = 0;
    const fetch = vi.fn().mockImplementation(async () => {
      inventory += 1;
      return new Response(JSON.stringify({ planned: 1, published: 1, rejected: 0, future_inventory: inventory }), { status: 200 });
    });

    const result = await run(['--apply', '--max-slots', '12'], {
      fetch,
      apiBaseUrl: 'https://example.test',
      cronSecret: 'secret',
      log: vi.fn(),
    });

    expect(result).toMatchObject({ published: 12 });
    expect(fetch).toHaveBeenCalledTimes(12);
    expect(fetch.mock.calls.every((call) => {
      const body = JSON.parse(call[1].body);
      return body.dry_run === false && body.max_slots === 1;
    })).toBe(true);
  });

  it('rejects an out-of-range slot count', () => {
    expect(() => parseArgs(['--max-slots', '13'])).toThrow('max-slots must be between 1 and 12');
  });

  it('requires an explicit execution mode and rejects unknown arguments', () => {
    expect(() => parseArgs([])).toThrow('pass exactly one of --dry-run or --apply');
    expect(() => parseArgs(['--dry-run', '--apply'])).toThrow('pass exactly one of --dry-run or --apply');
    expect(() => parseArgs(['--dry-run', '--unexpected'])).toThrow('unknown argument: --unexpected');
  });

  it('fails safely on a non-successful protected route response', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('not safe to expose', { status: 500 }));

    await expect(run(['--dry-run'], {
      fetch,
      apiBaseUrl: 'https://example.test',
      cronSecret: 'secret',
      log: vi.fn(),
    })).rejects.toThrow('gathering content route failed (500)');
  });
});
