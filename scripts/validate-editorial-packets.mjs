import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const PACKET_DIRECTORY = new URL('../docs/editorial/pt-BR/', import.meta.url);
const ALLOWED_CAMPAIGNS = new Set(['android_first_launch']);

function packetFailure(name, message) {
  return `${name}: ${message}`;
}

function campaignFromUrl(value) {
  const url = new URL(value);
  const referrer = new URLSearchParams(url.searchParams.get('referrer') ?? '');
  return referrer.get('utm_campaign');
}

async function main() {
  const files = (await readdir(PACKET_DIRECTORY)).filter((file) => file.endsWith('.json')).sort();
  const failures = [];

  if (files.length !== 4) failures.push(`expected exactly four PT-BR packets, found ${files.length}`);

  for (const file of files) {
    const packet = JSON.parse(await readFile(new URL(file, PACKET_DIRECTORY), 'utf8'));
    const name = path.basename(file);
    if (packet.locale !== 'pt-BR') failures.push(packetFailure(name, 'locale must be pt-BR'));
    if (packet.status !== 'draft') failures.push(packetFailure(name, 'status must be draft'));
    if (packet.review?.human_reviewed === true && !packet.approval?.name?.trim()) {
      failures.push(packetFailure(name, 'human_reviewed requires a named approval record'));
    }
    if (!packet.authoritative_article?.existing_url?.startsWith('/pt/blog/')) {
      failures.push(packetFailure(name, 'must reuse an existing localized article URL'));
    }
    if (!Array.isArray(packet.short_video_scripts) || packet.short_video_scripts.length !== 3) {
      failures.push(packetFailure(name, 'must contain three short-video scripts'));
    }
    if (!Array.isArray(packet.share_cards) || packet.share_cards.length !== 2) {
      failures.push(packetFailure(name, 'must contain two share-card specifications'));
    }
    try {
      const campaign = campaignFromUrl(packet.store_cta?.url ?? '');
      if (!ALLOWED_CAMPAIGNS.has(packet.store_cta?.campaign) || campaign !== packet.store_cta?.campaign) {
        failures.push(packetFailure(name, 'CTA URL must use an allowlisted campaign code'));
      }
    } catch {
      failures.push(packetFailure(name, 'CTA URL must be valid'));
    }
  }

  if (failures.length) throw new Error(failures.join('\n'));
  process.stdout.write(`Validated ${files.length} PT-BR draft editorial packets.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
