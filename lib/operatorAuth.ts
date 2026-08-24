import crypto from 'node:crypto';
import { fail } from '@/lib/http';

type OperatorAccess = { authorized: true } | { response: ReturnType<typeof fail> };

export function requireOperatorAccess(request: Request): OperatorAccess {
  const expected = process.env.VELLA_OPERATOR_API_KEY?.trim();
  if (!expected || expected.length < 32) {
    return {
      response: fail('Operator API is not configured', 503, { code: 'operator_configuration_missing' }),
    };
  }

  const provided = request.headers.get('x-vella-operator-key')?.trim() ?? '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const authorized =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!authorized) {
    return { response: fail('Unauthorized', 401, { code: 'operator_authentication_required' }) };
  }

  return { authorized: true };
}
