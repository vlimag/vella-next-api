import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseQuery } from '../lib/validation';

describe('parseQuery', () => {
  it('returns parsed data for valid input', () => {
    const schema = z.object({ q: z.string().min(2) });
    const result = parseQuery(schema, { q: 'faith' });

    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data.q).toBe('faith');
    }
  });

  it('returns error for invalid input', () => {
    const schema = z.object({ q: z.string().min(2) });
    const result = parseQuery(schema, { q: '' });

    expect('error' in result).toBe(true);
  });
});
