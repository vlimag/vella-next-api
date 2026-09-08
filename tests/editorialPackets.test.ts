import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PT-BR editorial packets', () => {
  it('validates four draft packets before they can be considered for publication', () => {
    const output = execFileSync(process.execPath, ['scripts/validate-editorial-packets.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toBe('Validated 4 PT-BR draft editorial packets and 8 share-card assets.\n');
  }, 30_000);

  it('keeps complete approval-gated copy and distinct measurable CTAs in every packet', () => {
    const packets = readdirSync('docs/editorial/pt-BR')
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(readFileSync(`docs/editorial/pt-BR/${file}`, 'utf8')));
    const campaigns = new Set<string>();
    const contents = new Set<string>();

    expect(packets).toHaveLength(4);
    for (const packet of packets) {
      expect(packet.status).toBe('draft');
      expect(packet.review.human_reviewed).toBe(false);
      expect(packet.approval).toBeNull();
      expect(packet.authoritative_article.draft).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        body_markdown: expect.any(String),
      });
      expect(packet.authoritative_article.draft.body_markdown.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0).toBeGreaterThanOrEqual(700);
      expect(packet.short_video_scripts).toHaveLength(3);
      for (const script of packet.short_video_scripts) {
        expect(script).toMatchObject({
          hook: expect.any(String),
          spoken_body: expect.any(String),
          on_screen_text: expect.any(String),
          cta: expect.any(String),
        });
        expect(script.approximate_duration_seconds).toBeGreaterThanOrEqual(15);
        expect(script.approximate_duration_seconds).toBeLessThanOrEqual(30);
        expect(`${script.hook} ${script.spoken_body} ${script.on_screen_text} ${script.cta}`).not.toMatch(/rascunho|revis[aã]o|publica[çc][aã]o|editorial/iu);
      }
      expect(packet.reader_cta).toMatchObject({ label: expect.any(String), url: expect.any(String) });
      expect(packet.share_cards).toHaveLength(2);
      for (const card of packet.share_cards) {
        expect(card).toMatchObject({
          path: expect.any(String),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          art_direction: expect.any(String),
          alt_text: expect.any(String),
        });
      }
      const referrer = new URLSearchParams(new URL(packet.store_cta.url).searchParams.get('referrer') ?? '');
      campaigns.add(referrer.get('utm_campaign') ?? '');
      contents.add(referrer.get('utm_content') ?? '');
    }
    expect(campaigns.size).toBe(4);
    expect(contents.size).toBe(4);
  });

  it('keeps the Brazil spring article unpublished until named editorial approval', () => {
    const packet = JSON.parse(readFileSync('docs/editorial/pt-BR/2026-09-07-semana-4-jornada-sazonal-compartilhada.json', 'utf8'));

    expect(packet.authoritative_article).toMatchObject({
      proposed_slug: expect.stringMatching(/^primavera-no-brasil-/u),
      publication_state: 'unpublished_draft',
      required_approval: 'named_human_editorial_approval',
      draft: { body_markdown: expect.any(String) },
    });
    expect(packet.authoritative_article.draft.body_markdown.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0).toBeGreaterThanOrEqual(700);
  });

  it('rejects a packet URL that is not a currently published PT article', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vella-packets-'));
    const packet = JSON.parse(readFileSync('docs/editorial/pt-BR/2026-09-07-semana-1-orar-quando-faltam-palavras.json', 'utf8'));
    packet.authoritative_article.existing_url = '/pt/blog/not-a-published-article';
    for (const file of readdirSync('docs/editorial/pt-BR').filter((entry) => entry.endsWith('.json'))) {
      const content = file === '2026-09-07-semana-1-orar-quando-faltam-palavras.json'
        ? packet
        : JSON.parse(readFileSync(`docs/editorial/pt-BR/${file}`, 'utf8'));
      writeFileSync(join(directory, file), JSON.stringify(content));
    }

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
  }, 30_000);

  it('rejects editorial-process language from audience-facing video copy', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vella-packets-'));
    const packet = JSON.parse(readFileSync('docs/editorial/pt-BR/2026-09-07-semana-1-orar-quando-faltam-palavras.json', 'utf8'));
    packet.short_video_scripts[0].cta = 'Leia o rascunho completo antes de publicar';
    for (const file of readdirSync('docs/editorial/pt-BR').filter((entry) => entry.endsWith('.json'))) {
      const content = file === '2026-09-07-semana-1-orar-quando-faltam-palavras.json'
        ? packet
        : JSON.parse(readFileSync(`docs/editorial/pt-BR/${file}`, 'utf8'));
      writeFileSync(join(directory, file), JSON.stringify(content));
    }

    try {
      expect(() => execFileSync(process.execPath, ['scripts/validate-editorial-packets.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, EDITORIAL_PACKET_DIRECTORY: directory },
        stdio: 'pipe',
      })).toThrow(/audience-facing wording/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it('rejects internal release cadence language from article copy', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vella-packets-'));
    const packet = JSON.parse(readFileSync('docs/editorial/pt-BR/2026-09-07-semana-4-jornada-sazonal-compartilhada.json', 'utf8'));
    packet.authoritative_article.draft.body_markdown += ' Esta cadência de quatro semanas não é linguagem para leitores.';

    for (const file of readdirSync('docs/editorial/pt-BR').filter((entry) => entry.endsWith('.json'))) {
      const content = file === '2026-09-07-semana-4-jornada-sazonal-compartilhada.json'
        ? packet
        : JSON.parse(readFileSync(`docs/editorial/pt-BR/${file}`, 'utf8'));
      writeFileSync(join(directory, file), JSON.stringify(content));
    }

    try {
      expect(() => execFileSync(process.execPath, ['scripts/validate-editorial-packets.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, EDITORIAL_PACKET_DIRECTORY: directory },
        stdio: 'pipe',
      })).toThrow(/internal release wording/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
