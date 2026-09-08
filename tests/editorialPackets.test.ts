import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PT-BR editorial packets', () => {
  it('validates four draft packets before they can be considered for publication', () => {
    const output = execFileSync(process.execPath, ['scripts/validate-editorial-packets.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toBe('Validated 4 PT-BR draft editorial packets.\n');
  });

  it('rejects a packet URL that is not a currently published PT article', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vella-packets-'));
    const packet = JSON.parse(readFileSync('docs/editorial/pt-BR/2026-09-07-semana-1-orar-quando-faltam-palavras.json', 'utf8'));
    packet.authoritative_article.existing_url = '/pt/blog/not-a-published-article';
    writeFileSync(join(directory, 'invalid.json'), JSON.stringify(packet));

    try {
      expect(() => execFileSync(process.execPath, ['scripts/validate-editorial-packets.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, EDITORIAL_PACKET_DIRECTORY: directory },
        stdio: 'pipe',
      })).toThrow(/currently published PT article/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
