import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LONG_JOURNEY_LOCALES,
  LONG_JOURNEY_STEP_TYPES,
  steadyFlame14,
  type LongJourneyManifest,
} from '../content/rhythms/steadyFlame14';
import { rooted21 } from '../content/rhythms/rooted21';
import { pilgrim40 } from '../content/rhythms/pilgrim40';

const JOURNEYS = [steadyFlame14, rooted21, pilgrim40] as const;
const EXPECTED = [
  { slug: 'steady_flame_14', sessions: 14, badge: 'journey_steady_flame_14', tier: 'steady_flame', asset: 'flame.steady' },
  { slug: 'rooted_21', sessions: 21, badge: 'journey_rooted_21', tier: 'rooted', asset: 'flame.rooted' },
  { slug: 'pilgrim_40', sessions: 40, badge: 'journey_pilgrim_40', tier: 'pilgrim', asset: 'flame.pilgrim' },
] as const;

function migrationFor(slug: string) {
  const directory = path.resolve(process.cwd(), '../supabase/migrations');
  const matches = fs.readdirSync(directory).filter((name) => name.endsWith(`_${slug}.sql`));
  expect(matches).toHaveLength(1);
  return {
    name: matches[0] ?? '',
    sql: matches.length === 1 ? fs.readFileSync(path.join(directory, matches[0]!), 'utf8') : '',
  };
}

function assertManifest(manifest: LongJourneyManifest, expected: (typeof EXPECTED)[number]) {
  expect(manifest.slug).toBe(expected.slug);
  expect(manifest.version).toBe(1);
  expect(manifest.sessionCount).toBe(expected.sessions);
  expect(manifest.sessions).toHaveLength(expected.sessions);
  expect(Object.keys(manifest.localizations).sort()).toEqual([...LONG_JOURNEY_LOCALES].sort());
  expect(manifest.badge).toEqual({
    code: expected.badge,
    tier: expected.tier,
    assetKey: expected.asset,
    targetValue: expected.sessions,
  });

  for (const locale of LONG_JOURNEY_LOCALES) {
    const copy = manifest.localizations[locale];
    expect(copy.title.trim().length).toBeGreaterThan(3);
    expect(copy.subtitle.trim().length).toBeGreaterThan(5);
    expect(copy.description.trim().length).toBeGreaterThan(12);
  }

  const blockIds = new Set<string>();
  const englishSignatures = new Set<string>();
  for (const [index, session] of manifest.sessions.entries()) {
    expect(session.number).toBe(index + 1);
    expect(session.steps.map((step) => step.type)).toEqual(LONG_JOURNEY_STEP_TYPES);
    expect(session.steps).toHaveLength(4);
    expect(session.estimatedSeconds).toBeGreaterThanOrEqual(180);
    expect(session.estimatedSeconds).toBeLessThanOrEqual(480);
    expect(session.steps.reduce((total, step) => total + step.estimatedSeconds, 0)).toBe(session.estimatedSeconds);

    const paddedSession = String(session.number).padStart(2, '0');
    for (const step of session.steps) {
      expect(step.blockId).toBe(`${manifest.slug}_v${manifest.version}_s${paddedSession}_${step.type}`);
      expect(blockIds.has(step.blockId)).toBe(false);
      blockIds.add(step.blockId);
      expect(step.poolTag).toBe(`${manifest.slug}_v${manifest.version}_s${paddedSession}`);

      for (const locale of LONG_JOURNEY_LOCALES) {
        const copy = step.localizations[locale];
        expect(copy.title.trim().length).toBeGreaterThan(1);
        expect(copy.cta.trim().length).toBeGreaterThan(1);
        if (step.type === 'verse') {
          expect(copy.body).toBe('');
        } else {
          expect(copy.body.trim().length).toBeGreaterThan(12);
        }
      }
    }

    const signature = session.steps
      .filter((step) => step.type !== 'verse')
      .map((step) => step.localizations.en.body)
      .join('|');
    expect(englishSignatures.has(signature)).toBe(false);
    englishSignatures.add(signature);
  }
  expect(blockIds.size).toBe(expected.sessions * 4);
}

describe('long Vella journey editorial manifests', () => {
  it('defines stable, fully localized 14-, 21-, and 40-session paths', () => {
    for (const [index, journey] of JOURNEYS.entries()) assertManifest(journey, EXPECTED[index]!);
  });

  it('contains 75 distinct editorial sessions rather than repeated seven-session cycles', () => {
    const globalIds = new Set(JOURNEYS.flatMap((journey) => journey.sessions.flatMap((session) => session.steps.map((step) => step.blockId))));
    expect(JOURNEYS.reduce((total, journey) => total + journey.sessions.length, 0)).toBe(75);
    expect(globalIds.size).toBe(75 * 4);

    for (const journey of JOURNEYS) {
      const firstSeven = journey.sessions.slice(0, 7).map((session) => session.theme);
      for (let offset = 7; offset < journey.sessions.length; offset += 7) {
        expect(journey.sessions.slice(offset, offset + 7).map((session) => session.theme)).not.toEqual(firstSeven.slice(0, Math.min(7, journey.sessions.length - offset)));
      }
    }
  });

  it('generates three ordered, additive, idempotent stable-key seed migrations', () => {
    const migrations = JOURNEYS.map((journey) => migrationFor(journey.slug));
    expect(migrations.map(({ name }) => name)).toEqual([...migrations.map(({ name }) => name)].sort());

    for (const [index, { sql }] of migrations.entries()) {
      const expected = EXPECTED[index]!;
      expect(sql).toContain(`'${expected.slug}'`);
      expect(sql).toMatch(/version[\s\S]*1/i);
      expect(sql).toContain(`'${expected.badge}'`);
      expect(sql).toMatch(/on conflict \(slug, language_code, version\) do update/i);
      expect(sql).toMatch(/on conflict \(slug\) do update/i);
      expect(sql).toMatch(/on conflict \(block_id, language_code\) do update/i);
      expect(sql).toMatch(/on conflict \(template_id, day_number, step_order\) do update/i);
      expect(sql).not.toMatch(/insert\s+into\s+faith_harbor\.bible_verses/i);
      expect(sql).not.toMatch(/\b(?:drop|truncate)\s+(?:table|schema)\b|drop\s+column/i);
      for (const locale of LONG_JOURNEY_LOCALES) expect(sql).toContain(`'${locale}'`);
    }
  });
});
