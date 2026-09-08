import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const PACKET_DIRECTORY = process.env.EDITORIAL_PACKET_DIRECTORY
  ? pathToFileURL(`${resolve(process.env.EDITORIAL_PACKET_DIRECTORY)}/`)
  : new URL('../docs/editorial/pt-BR/', import.meta.url);
const ALLOWED_CAMPAIGNS = new Set([
  'ptbr_w1_orar_palavras',
  'ptbr_w2_devocional_curto',
  'ptbr_w3_entender_passagem',
  'ptbr_w4_primavera_2026',
]);
const SAFE_CODE = /^[a-z0-9][a-z0-9._~-]{0,63}$/u;
const EDITORIAL_PROCESS_LANGUAGE = /rascunho|revis[aã]o|publica[çc][aã]o|editorial/iu;
const INTERNAL_RELEASE_LANGUAGE = /cadência de quatro semanas|a primavera começa durante esta jornada/iu;

function packetFailure(name, message) {
  return `${name}: ${message}`;
}

function campaignFromUrl(value) {
  const url = new URL(value);
  const referrer = new URLSearchParams(url.searchParams.get('referrer') ?? '');
  return referrer.get('utm_campaign');
}

function referrerFromUrl(value) {
  const url = new URL(value);
  return new URLSearchParams(url.searchParams.get('referrer') ?? '');
}

function isCanonicalPlayStoreUrl(value, expectedCampaign) {
  const url = new URL(value);
  const outerKeys = [...url.searchParams.keys()];
  if (url.origin !== 'https://play.google.com' || url.pathname !== '/store/apps/details'
    || outerKeys.length !== 2 || new Set(outerKeys).size !== 2
    || url.searchParams.get('id') !== 'io.vella.app' || !url.searchParams.get('referrer')) return false;

  const referrer = referrerFromUrl(value);
  const nestedKeys = [...referrer.keys()];
  return nestedKeys.length === 4 && new Set(nestedKeys).size === 4
    && referrer.get('utm_source') === 'vella.one'
    && referrer.get('utm_medium') === 'website'
    && referrer.get('utm_campaign') === expectedCampaign
    && SAFE_CODE.test(referrer.get('utm_content') ?? '');
}

function wordCount(value) {
  return (value ?? '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

async function publishedPtArticleUrls() {
  const source = await readFile(new URL('../lib/site/blog.ts', import.meta.url), 'utf8');
  const slugs = source.match(/export const BLOG_SLUGS = \[([\s\S]*?)\] as const;/u)?.[1]
    .match(/'([^']+)'/gu)
    ?.map((entry) => entry.slice(1, -1)) ?? [];
  return new Set(slugs.map((slug) => `/pt/blog/${slug}`));
}

async function main() {
  const files = (await readdir(PACKET_DIRECTORY)).filter((file) => file.endsWith('.json')).sort();
  const publishedUrls = await publishedPtArticleUrls();
  const failures = [];
  const campaigns = new Set();
  const contents = new Set();

  if (files.length !== 4) failures.push(`expected exactly four PT-BR packets, found ${files.length}`);

  for (const file of files) {
    const packet = JSON.parse(await readFile(new URL(file, PACKET_DIRECTORY), 'utf8'));
    const name = path.basename(file);
    if (packet.locale !== 'pt-BR') failures.push(packetFailure(name, 'locale must be pt-BR'));
    if (packet.status !== 'draft') failures.push(packetFailure(name, 'status must be draft'));
    if (packet.review?.human_reviewed === true && !packet.approval?.name?.trim()) {
      failures.push(packetFailure(name, 'human_reviewed requires a named approval record'));
    }
    const draft = packet.authoritative_article?.draft;
    const draftWords = wordCount(draft?.body_markdown);
    if (!draft?.title || !draft?.description || !draft?.body_markdown || draftWords < 700) {
      failures.push(packetFailure(name, 'must include a complete authoritative article draft'));
    }
    if (INTERNAL_RELEASE_LANGUAGE.test(draft?.body_markdown ?? '')) {
      failures.push(packetFailure(name, 'article copy must not use internal release wording'));
    }
    const isSeasonalDraft = packet.authoritative_article?.publication_state === 'unpublished_draft';
    if (!isSeasonalDraft && !publishedUrls.has(packet.authoritative_article?.existing_url)) {
      failures.push(packetFailure(name, 'must map to a currently published PT article'));
    }
    if (isSeasonalDraft && (!/^primavera-no-brasil-[a-z0-9-]+$/u.test(packet.authoritative_article.proposed_slug ?? '')
      || packet.authoritative_article.required_approval !== 'named_human_editorial_approval')) {
      failures.push(packetFailure(name, 'seasonal draft must remain gated on named editorial approval'));
    }
    if (!Array.isArray(packet.short_video_scripts) || packet.short_video_scripts.length !== 3
      || packet.short_video_scripts.some((script) => !script.hook || !script.spoken_body || !script.on_screen_text
        || !script.cta || !Number.isInteger(script.approximate_duration_seconds)
        || script.approximate_duration_seconds < 15 || script.approximate_duration_seconds > 30)) {
      failures.push(packetFailure(name, 'must contain three short-video scripts'));
    }
    if (packet.short_video_scripts?.some((script) => EDITORIAL_PROCESS_LANGUAGE.test(
      `${script.hook} ${script.spoken_body} ${script.on_screen_text} ${script.cta}`,
    ))) {
      failures.push(packetFailure(name, 'video copy must use audience-facing wording'));
    }
    if (!packet.reader_cta?.label || !packet.reader_cta?.url) {
      failures.push(packetFailure(name, 'must contain a reader-facing CTA'));
    }
    if (!Array.isArray(packet.share_cards) || packet.share_cards.length !== 2) {
      failures.push(packetFailure(name, 'must contain two share-card specifications'));
    } else {
      for (const card of packet.share_cards) {
        const [width, height] = String(card.dimensions).split('x').map(Number);
        const assetPath = path.resolve(process.cwd(), card.path ?? '');
        try {
          await access(assetPath);
          const bytes = await readFile(assetPath);
          const metadata = await sharp(bytes).metadata();
          const hash = createHash('sha256').update(bytes).digest('hex');
          if (!((width === 1080 && (height === 1080 || height === 1920))
            && metadata.width === width && metadata.height === height
            && metadata.space === 'srgb' && !metadata.hasAlpha
            && card.sha256 === hash && /^[a-f0-9]{64}$/u.test(card.sha256)
            && card.art_direction && card.alt_text)) {
            failures.push(packetFailure(name, 'share card must have declared RGB dimensions, hash, art direction, and alt text'));
          }
        } catch {
          failures.push(packetFailure(name, 'share card asset must exist and be readable'));
        }
      }
    }
    try {
      const referrer = referrerFromUrl(packet.store_cta?.url ?? '');
      const campaign = campaignFromUrl(packet.store_cta?.url ?? '');
      const content = referrer.get('utm_content');
      if (!ALLOWED_CAMPAIGNS.has(packet.store_cta?.campaign) || campaign !== packet.store_cta?.campaign
        || !isCanonicalPlayStoreUrl(packet.store_cta?.url ?? '', packet.store_cta?.campaign)) {
        failures.push(packetFailure(name, 'CTA URL must use the exact Play Store URL and allowlisted campaign code'));
      }
      campaigns.add(campaign);
      contents.add(content);
    } catch {
      failures.push(packetFailure(name, 'CTA URL must be valid'));
    }
  }

  if (campaigns.size !== 4 || contents.size !== 4) {
    failures.push('packets must use distinct campaign and utm_content codes');
  }

  if (failures.length) throw new Error(failures.join('\n'));
  process.stdout.write(`Validated ${files.length} PT-BR draft editorial packets and ${files.length * 2} share-card assets.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
