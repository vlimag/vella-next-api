import { afterEach, describe, expect, it } from 'vitest';
import { requireOperatorAccess } from '../lib/operatorAuth';

const originalKey = process.env.VELLA_OPERATOR_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.VELLA_OPERATOR_API_KEY;
  else process.env.VELLA_OPERATOR_API_KEY = originalKey;
});

describe('operator authentication', () => {
  it('fails closed when the operator key is not configured', async () => {
    delete process.env.VELLA_OPERATOR_API_KEY;
    const result = requireOperatorAccess(new Request('https://vella.one/api/v1/operator/moderation/reports'));
    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(503);
  });

  it('rejects a wrong operator key', () => {
    process.env.VELLA_OPERATOR_API_KEY = 'a'.repeat(48);
    const result = requireOperatorAccess(new Request(
      'https://vella.one/api/v1/operator/moderation/reports',
      { headers: { 'x-vella-operator-key': 'b'.repeat(48) } },
    ));
    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(401);
  });

  it('accepts the exact configured operator key', () => {
    const key = 'production-operator-key-'.padEnd(48, 'x');
    process.env.VELLA_OPERATOR_API_KEY = key;
    const result = requireOperatorAccess(new Request(
      'https://vella.one/api/v1/operator/moderation/reports',
      { headers: { 'x-vella-operator-key': key } },
    ));
    expect(result).toEqual({ authorized: true });
  });
});
