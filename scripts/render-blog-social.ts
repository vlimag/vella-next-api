/** Deterministic editorial art only; these images do not depict application UI. */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LOCALES } from '../lib/site/config';
import { growthArticles, NEW_BLOG_SLUGS } from '../lib/site/growthArticles';

const output = fileURLToPath(new URL('../public/blog', import.meta.url));
await mkdir(output, { recursive: true });
const xml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function lines(text: string, limit = 32) {
  const rows: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = rows.length - 1;
    if (last < 0 || `${rows[last]} ${word}`.length > limit) rows.push(word);
    else rows[last] += ` ${word}`;
  }
  return rows;
}

for (const locale of LOCALES) for (const [index, slug] of NEW_BLOG_SLUGS.entries()) {
  const article = growthArticles(locale)[slug];
  const rows = lines(article.title);
  if (rows.length > 5) throw new Error(`Title requires visual reflow: ${locale}/${slug}`);
  const night = index === 1;
  const mark = night
    ? '<path d="M976 216 A108 108 0 1 0 1045 385 A91 91 0 0 1 976 216Z" fill="#e6bf78"/><circle cx="1080" cy="185" r="4" fill="#f8ead3"/><circle cx="893" cy="218" r="3" fill="#f8ead3"/><path d="M1063 275h20m-10-10v20" stroke="#e6bf78" stroke-width="2"/>'
    : '<g fill="none" stroke="#e6bf78" stroke-width="3"><path d="M870 260Q925 242 975 273Q1025 242 1080 260V408Q1025 390 975 421Q925 390 870 408Z"/><path d="M975 273V421M894 285Q925 278 951 292M894 311Q925 304 951 318M894 337Q925 330 951 344M1000 292Q1030 278 1057 285M1000 318Q1030 304 1057 311M1000 344Q1030 330 1057 337"/></g>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><radialGradient id="glow"><stop stop-color="${night ? '#5d496c' : '#34504b'}"/><stop offset="1" stop-color="${night ? '#1a182b' : '#101f28'}"/></radialGradient></defs>
    <rect width="1200" height="630" fill="${night ? '#1a182b' : '#101f28'}"/>
    <circle cx="1040" cy="330" r="390" fill="url(#glow)"/>
    <circle cx="980" cy="319" r="208" fill="none" stroke="#e6bf78" stroke-opacity=".13"/>
    <circle cx="980" cy="319" r="244" fill="none" stroke="#e6bf78" stroke-opacity=".07"/>
    <text x="70" y="92" font-family="Georgia,serif" font-size="48" fill="#f8ead3">Vella<tspan fill="#e6bf78">.</tspan></text>
    <text x="72" y="171" font-family="Arial,sans-serif" font-size="18" letter-spacing="2" fill="#e6bf78">${xml(article.category.toLocaleUpperCase(locale))}</text>
    ${rows.map((line, i) => `<text x="68" y="${247 + i * 59}" font-family="Georgia,serif" font-size="49" fill="#fff8ed">${xml(line)}</text>`).join('')}
    ${mark}
    <path d="M72 545H1128" stroke="#e6bf78" stroke-opacity=".25"/>
    <text x="72" y="589" font-family="Arial,sans-serif" font-size="19" fill="#c2b9ae">vella.one</text>
    <text x="1128" y="589" text-anchor="end" font-family="Arial,sans-serif" font-size="16" letter-spacing="2" fill="#e6bf78">${locale === 'pt' ? 'PT-BR' : locale.toUpperCase()}</text>
  </svg>`;
  const path = resolve(output, `${night ? 'evening' : 'reading'}-${locale}.png`);
  await sharp(Buffer.from(svg)).flatten({ background: '#101f28' }).png().toFile(path);
  console.log(`${locale}: ${night ? 'evening' : 'reading'} — ${rows.length} lines`);
}
