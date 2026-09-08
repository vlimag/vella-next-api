import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('PT-BR editorial packets', () => {
  it('validates four draft packets before they can be considered for publication', () => {
    const output = execFileSync(process.execPath, ['scripts/validate-editorial-packets.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toBe('Validated 4 PT-BR draft editorial packets.\n');
  });
});
