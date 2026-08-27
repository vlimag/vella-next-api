/**
 * Safe, importable inventory bootstrapper.
 *
 * It deliberately delegates all generation, validation, review, and publishing
 * to the protected production cron route. This file contains no editorial copy.
 */

export const REVIEWED_EVERGREEN_FALLBACKS = Object.freeze([
  Object.freeze({ key: 'evergreen-monday-quiet-beginning', slot_type: 'monday', reviewed: true }),
  Object.freeze({ key: 'evergreen-thursday-gentle-renewal', slot_type: 'thursday', reviewed: true }),
]);

function integer(value) {
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

export function parseArgs(argv) {
  let mode = null;
  let maxSlots = 12;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run' || argument === '--apply') {
      if (mode) throw new Error('pass exactly one of --dry-run or --apply');
      mode = argument === '--dry-run' ? 'dry-run' : 'apply';
      continue;
    }
    if (argument === '--max-slots') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--max-slots requires a value');
      index += 1;
      maxSlots = integer(value);
      if (!Number.isInteger(maxSlots) || maxSlots < 1 || maxSlots > 12) {
        throw new Error('max-slots must be between 1 and 12');
      }
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  if (!mode) throw new Error('pass exactly one of --dry-run or --apply');
  return { dryRun: mode === 'dry-run', maxSlots };
}

function safeCounts(payload) {
  const result = {};
  for (const key of ['planned', 'published', 'rejected', 'future_inventory']) {
    if (Number.isInteger(payload?.[key]) && payload[key] >= 0) result[key] = payload[key];
  }
  return result;
}

export async function run(argv, dependencies = {}) {
  const { dryRun, maxSlots } = parseArgs(argv);
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const apiBaseUrl = (dependencies.apiBaseUrl ?? process.env.VELLA_API_BASE_URL ?? 'https://vella.one').replace(/\/$/, '');
  const cronSecret = dependencies.cronSecret ?? process.env.CRON_SECRET;
  const log = dependencies.log ?? ((line) => console.log(line));

  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
  if (!cronSecret) throw new Error('CRON_SECRET is required');

  const request = async (slots) => {
    const response = await fetchImpl(`${apiBaseUrl}/api/cron/gathering-content`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        dry_run: dryRun,
        max_slots: slots,
        evergreen_fallbacks: REVIEWED_EVERGREEN_FALLBACKS,
      }),
    });
    if (!response.ok) throw new Error(`gathering content route failed (${response.status})`);
    try { return safeCounts(await response.json()); }
    catch { throw new Error('gathering content route returned invalid JSON'); }
  };

  let result;
  if (dryRun) {
    result = await request(maxSlots);
  } else {
    result = { planned: 0, published: 0, rejected: 0, future_inventory: 0 };
    for (let index = 0; index < maxSlots; index += 1) {
      const current = await request(1);
      result.planned += current.planned ?? 0;
      result.published += current.published ?? 0;
      result.rejected += current.rejected ?? 0;
      result.future_inventory = current.future_inventory ?? result.future_inventory;
      if ((current.planned ?? 0) === 0 || (current.published ?? 0) === 0 || result.future_inventory >= 12) break;
    }
  }
  log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', max_slots: maxSlots, ...result }));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'gathering seed failed');
    process.exitCode = 1;
  });
}
