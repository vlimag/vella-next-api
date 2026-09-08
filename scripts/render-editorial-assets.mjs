import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PACKET_DIRECTORY = new URL('../docs/editorial/pt-BR/', import.meta.url);

function escapeXml(value) {
  return value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function shareCardSvg({ width, height, copyLines, accent }) {
  const headlineSize = width === 1080 ? 68 : 86;
  const lineHeight = Math.round(headlineSize * 1.18);
  const startY = Math.round(height * 0.53);
  const lines = copyLines.map((line, index) => `<text x="92" y="${startY + index * lineHeight}" fill="#fffaf0" font-family="Arial, sans-serif" font-size="${headlineSize}" font-weight="700">${escapeXml(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#071225"/><circle cx="${Math.round(width * .82)}" cy="${Math.round(height * .15)}" r="${Math.round(width * .34)}" fill="${accent}" opacity=".18"/><path d="M0 ${Math.round(height * .82)} C${Math.round(width * .2)} ${Math.round(height * .65)}, ${Math.round(width * .52)} ${Math.round(height * .98)}, ${width} ${Math.round(height * .73)} L${width} ${height} L0 ${height} Z" fill="#122542"/><text x="92" y="116" fill="#f5c66f" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="8">VELLA</text><text x="92" y="178" fill="#d9e1ef" font-family="Arial, sans-serif" font-size="26" font-weight="600">BÍBLIA · ORAÇÃO · REFLEXÃO</text>${lines}<rect x="92" y="${height - 150}" width="86" height="4" rx="2" fill="#f5c66f"/></svg>`;
}

async function main() {
  const files = (await readdir(PACKET_DIRECTORY)).filter((file) => file.endsWith('.json')).sort();
  let count = 0;
  for (const file of files) {
    const packet = JSON.parse(await readFile(new URL(file, PACKET_DIRECTORY), 'utf8'));
    for (const card of packet.share_cards ?? []) {
      const output = path.resolve(process.cwd(), card.path);
      await mkdir(path.dirname(output), { recursive: true });
      const [width, height] = card.dimensions.split('x').map(Number);
      await sharp(Buffer.from(shareCardSvg({ width, height, copyLines: card.copy_lines, accent: card.accent })))
        .flatten({ background: '#071225' })
        .removeAlpha()
        .toColourspace('srgb')
        .png()
        .toFile(output);
      count += 1;
    }
  }
  process.stdout.write(`Rendered ${count} PT-BR share-card assets.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
