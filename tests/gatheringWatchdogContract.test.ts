import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runGatheringWatchdog } from '../../supabase/functions/gathering-watchdog/index';

function source(file: string) {
  return fs.readFileSync(path.resolve(process.cwd(), '../supabase', file), 'utf8');
}

describe('gathering watchdog contract', () => {
  it('is an independently authorized Edge Function that queries only the three operational sources and calls Resend directly', () => {
    const code = source('functions/gathering-watchdog/index.ts');

    expect(code).toContain('GATHERING_WATCHDOG_SECRET');
    expect(code).toContain('https://api.resend.com/emails');
    expect(code).toContain('gathering_automation_heartbeats');
    expect(code).toContain('gathering_releases');
    expect(code).toContain('gathering_generation_incidents');
    expect(code).not.toMatch(/vercel\.app|api\/cron\/gathering-content/i);
    expect(code).not.toMatch(/gathering_templates|user_/i);
    expect(code).toMatch(/36\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(code).toContain('inventoryDepth < 6');
    expect(code).toContain('Idempotency-Key');
    expect(code).toMatch(/Authorization:\s*`Bearer \$\{[^}]*RESEND_API_KEY/);
    expect(code).toContain('watchdog_checked');
    expect(code).toContain('heartbeat_source');
    expect(code).toContain('incident_state=in.(open,alerted,recovered)');
  });

  it('treats an invalid heartbeat as stale and persists failed alert attempts for retry', async () => {
    const resendRequests: RequestInit[] = [];
    const patchBodies: Record<string, unknown>[] = [];
    const fakeFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes('gathering_automation_heartbeats')) {
        return new Response(JSON.stringify([{ observed_at: 'not-a-timestamp' }]));
      }
      if (url.includes('gathering_releases')) return new Response(JSON.stringify([]));
      if (url.includes('gathering_generation_incidents') && !init?.method) {
        return new Response(JSON.stringify([]));
      }
      if (url.includes('gathering_generation_incidents') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify([{ ...body, id: `${body.incident_key}-id` }]));
      }
      if (url === 'https://api.resend.com/emails') {
        resendRequests.push(init ?? {});
        return new Response('unavailable', { status: 503 });
      }
      if (url.includes('gathering_generation_incidents') && init?.method === 'PATCH') {
        patchBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response('');
      }
      if (url.includes('gathering_operational_events') || url.includes('gathering_automation_heartbeats')) {
        return new Response('', { status: 201 });
      }
      return new Response('unexpected', { status: 404 });
    });

    const result = await runGatheringWatchdog({
      fetch: fakeFetch,
      now: () => new Date('2026-08-27T12:00:00.000Z'),
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SUPABASE_DB_SCHEMA: 'faith_harbor',
        RESEND_API_KEY: 're_test_secret',
        OPS_ALERT_EMAIL: 'alerts@example.test',
        GATHERING_WATCHDOG_SECRET: 'watchdog-secret',
      },
    });

    expect(result.heartbeatStale).toBe(true);
    expect(result.alertsFailed).toBe(2);
    expect(resendRequests).toHaveLength(2);
    expect(patchBodies).toEqual(expect.arrayContaining([
      expect.objectContaining({ alert_state: 'failed', alert_attempts: 1 }),
    ]));
  });

  it('registers one hourly pg_cron job and reads URL and bearer secret from Vault at execution time', () => {
    const sql = source('migrations/20260827210300_gathering_watchdog_schedule.sql');

    expect(sql).toMatch(/cron\.schedule\s*\(/i);
    expect(sql).toContain("'gathering-watchdog-hourly'");
    expect(sql).toContain("'7 * * * *'");
    expect(sql).toMatch(/vault\.decrypted_secrets[\s\S]*gathering_watchdog_url/i);
    expect(sql).toMatch(/vault\.decrypted_secrets[\s\S]*gathering_watchdog_secret/i);
    expect(sql).toMatch(/net\.http_post\s*\(/i);
    expect(sql).toContain('configure_gathering_watchdog_vault');
    expect(sql).toContain('vault.create_secret');
    expect(sql).toContain('vault.update_secret');
    expect(sql).toMatch(/grant execute on function faith_harbor\.configure_gathering_watchdog_vault[\s\S]*to service_role/i);
    expect(sql).not.toMatch(/https?:\/\/[^'\s]*supabase\.co/i);
    expect(sql).not.toMatch(/(watchdog_secret|watchdog_url)\s*['"]\s*[:=]\s*['"][^'"$]+/i);
  });
});
