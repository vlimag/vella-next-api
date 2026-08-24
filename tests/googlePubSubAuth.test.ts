import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyGooglePubSubRequest } from '../lib/googlePlay';

describe('Google Pub/Sub push authentication', () => {
  const originalAudience = process.env.GOOGLE_PUBSUB_AUDIENCE;
  const originalEmail = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL;

  beforeEach(() => {
    process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://vella.one/api/v1/webhooks/google';
    process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL = 'vella-push@example.iam.gserviceaccount.com';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalAudience === undefined) delete process.env.GOOGLE_PUBSUB_AUDIENCE;
    else process.env.GOOGLE_PUBSUB_AUDIENCE = originalAudience;
    if (originalEmail === undefined) delete process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL = originalEmail;
  });

  it('accepts only a Google-signed token with the exact audience and service account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      aud: 'https://vella.one/api/v1/webhooks/google',
      email: 'vella-push@example.iam.gserviceaccount.com',
      email_verified: 'true',
      exp: String(Math.floor(Date.now() / 1000) + 300),
      iss: 'https://accounts.google.com',
    }), { status: 200 })));

    await expect(verifyGooglePubSubRequest('Bearer signed-token')).resolves.toEqual({ ok: true });
  });

  it('rejects a correctly signed token for a different audience', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      aud: 'https://attacker.example/webhook',
      email: 'vella-push@example.iam.gserviceaccount.com',
      email_verified: true,
      exp: String(Math.floor(Date.now() / 1000) + 300),
      iss: 'accounts.google.com',
    }), { status: 200 })));

    await expect(verifyGooglePubSubRequest('Bearer signed-token')).resolves.toEqual({
      ok: false,
      status: 401,
      error: 'Invalid Pub/Sub token claims',
    });
  });

  it("returns a retryable error when Google's verification service is unavailable", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));

    await expect(verifyGooglePubSubRequest('Bearer signed-token')).resolves.toEqual({
      ok: false,
      status: 503,
      error: 'Could not verify Pub/Sub bearer token',
    });
  });
});
