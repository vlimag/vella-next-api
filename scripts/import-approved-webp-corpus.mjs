import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const CORPORA = {
  WEBP: {
    sha256: 'e94393e5090704abba7233773be8df546f4fa35eebc3a40e84da8bd5e8f9af8d',
    expectedVerseCount: 31_098,
    sourceUrl: 'https://ebible.org/Scriptures/engwebp_vpl.zip',
    rightsUrl: 'https://ebible.org/engwebp/copyright.htm',
    languageCode: 'en',
    name: 'World English Bible',
    rightsLabel: 'Public Domain',
  },
  BPM: {
    sha256: 'a98e7b7d3f977b80716a5a7ecd443ece474593ca3d1770cf278a448b37b97287',
    expectedVerseCount: 31_098,
    sourceUrl: 'https://ebible.org/Scriptures/porbrbsl_vpl.zip',
    rightsUrl: 'https://ebible.org/porbrbsl/copyright.htm',
    languageCode: 'pt',
    name: 'Bíblia Portuguesa Mundial',
    rightsLabel: 'Public Domain',
  },
  RV1909: {
    sha256: '9d7aff52765d9e67b5d11ff667b6953319af39454ea32c53d6743401720594aa',
    expectedVerseCount: 31_084,
    sourceUrl: 'https://ebible.org/Scriptures/spaRV1909_vpl.zip',
    rightsUrl: 'https://ebible.org/spaRV1909/copyright.htm',
    languageCode: 'es',
    name: 'Santa Biblia — Reina Valera 1909',
    rightsLabel: 'Public Domain',
  },
  LSG1910: {
    sha256: 'c9a5ca9c81266fb4353767c619c79732c0530f709447d4903bc05485232de4cf',
    expectedVerseCount: 31_170,
    sourceUrl: 'https://ebible.org/Scriptures/fraLSG_vpl.zip',
    rightsUrl: 'https://ebible.org/fraLSG/copyright.htm',
    languageCode: 'fr',
    name: 'Louis Segond 1910',
    rightsLabel: 'Public Domain',
  },
  LUT1912: {
    sha256: 'f6723776717b2e18e53dc81b0b7758aeb6ce969aee9cfb432d9b61006fa13dff',
    expectedVerseCount: 31_102,
    sourceUrl: 'https://ebible.org/Scriptures/deu1912_vpl.zip',
    rightsUrl: 'https://ebible.org/deu1912/copyright.htm',
    languageCode: 'de',
    name: 'Lutherbibel 1912',
    rightsLabel: 'Public Domain',
  },
  DIODATI1885: {
    sha256: '949f40aad1fa9e9185c733a5339b1142ec17d7176ee9b6ed7c9cc51256f06a7d',
    expectedVerseCount: 31_095,
    sourceUrl: 'https://ebible.org/Scriptures/ita1885_vpl.zip',
    rightsUrl: 'https://ebible.org/ita1885/copyright.htm',
    languageCode: 'it',
    name: 'Diodati Bibbia 1885',
    rightsLabel: 'Public Domain',
  },
  RUSSYN: {
    sha256: '40b3e2c17769439b4743f94c0cf7ec18c02dbc68a6967c5bf096874fbee6a872',
    expectedVerseCount: 31_169,
    sourceUrl: 'https://ebible.org/Scriptures/russyn_vpl.zip',
    rightsUrl: 'https://ebible.org/russyn/copyright.htm',
    languageCode: 'ru',
    name: 'Синодальный перевод',
    rightsLabel: 'Public Domain',
  },
  UBG2018: {
    sha256: 'a1e5338b20d50fe0853e0ec4e8cff2221a0be8dec9dcf967a15377f84bc6820d',
    expectedVerseCount: 31_102,
    sourceUrl: 'https://ebible.org/Scriptures/polubg_vpl.zip',
    rightsUrl: 'https://ebible.org/polubg/copyright.htm',
    languageCode: 'pl',
    name: 'Święta Biblia — Uwspółcześniona Biblia Gdańska',
    rightsLabel: '© 2018 Fundacja Wrota Nadziei · CC BY-ND 4.0',
  },
  BG1881: {
    sha256: '97260a9a5e4042521cf5727c36dfe38624ab275349d1570770af76d89949c11b',
    expectedVerseCount: 31_108,
    sourceUrl: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/pol-gdanska.osis.xml',
    rightsUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=PolGdanska',
    languageCode: 'pl',
    name: 'Biblia Gdańska 1881',
    rightsLabel: 'Public Domain',
    sourceProvider: 'Open Bibles · CrossWire',
    sourceFormat: 'osis',
    replacesCodes: ['UBG2018'],
  },
};
const CORPUS_CODE = process.env.CORPUS_CODE ?? 'WEBP';
const CORPUS = CORPORA[CORPUS_CODE];
if (!CORPUS) throw new Error(`Unsupported approved corpus: ${CORPUS_CODE}`);
const BOOKS = [
  ['GEN', 'Genesis'], ['EXO', 'Exodus'], ['LEV', 'Leviticus'], ['NUM', 'Numbers'], ['DEU', 'Deuteronomy'],
  ['JOS', 'Joshua'], ['JDG', 'Judges'], ['RUT', 'Ruth'], ['1SA', '1 Samuel'], ['2SA', '2 Samuel'],
  ['1KI', '1 Kings'], ['2KI', '2 Kings'], ['1CH', '1 Chronicles'], ['2CH', '2 Chronicles'], ['EZR', 'Ezra'],
  ['NEH', 'Nehemiah'], ['EST', 'Esther'], ['JOB', 'Job'], ['PSA', 'Psalms'], ['PRO', 'Proverbs'],
  ['ECC', 'Ecclesiastes'], ['SNG', 'Song of Solomon'], ['ISA', 'Isaiah'], ['JER', 'Jeremiah'], ['LAM', 'Lamentations'],
  ['EZK', 'Ezekiel'], ['DAN', 'Daniel'], ['HOS', 'Hosea'], ['JOL', 'Joel'], ['AMO', 'Amos'],
  ['OBA', 'Obadiah'], ['JON', 'Jonah'], ['MIC', 'Micah'], ['NAM', 'Nahum'], ['HAB', 'Habakkuk'],
  ['ZEP', 'Zephaniah'], ['HAG', 'Haggai'], ['ZEC', 'Zechariah'], ['MAL', 'Malachi'], ['MAT', 'Matthew'],
  ['MRK', 'Mark'], ['LUK', 'Luke'], ['JHN', 'John'], ['ACT', 'Acts'], ['ROM', 'Romans'],
  ['1CO', '1 Corinthians'], ['2CO', '2 Corinthians'], ['GAL', 'Galatians'], ['EPH', 'Ephesians'], ['PHP', 'Philippians'],
  ['COL', 'Colossians'], ['1TH', '1 Thessalonians'], ['2TH', '2 Thessalonians'], ['1TI', '1 Timothy'], ['2TI', '2 Timothy'],
  ['TIT', 'Titus'], ['PHM', 'Philemon'], ['HEB', 'Hebrews'], ['JAS', 'James'], ['1PE', '1 Peter'],
  ['2PE', '2 Peter'], ['1JN', '1 John'], ['2JN', '2 John'], ['3JN', '3 John'], ['JUD', 'Jude'], ['REV', 'Revelation'],
];

const SOURCE_CODE_MAP = {
  '1JO': '1JN', '2JO': '2JN', '3JO': '3JN',
  EZE: 'EZK', JAM: 'JAS', JOE: 'JOL', JOH: 'JHN', MAR: 'MRK',
  NAH: 'NAM', PHI: 'PHP', SOL: 'SNG',
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const OSIS_CODE_MAP = {
  Gen: 'GEN', Exod: 'EXO', Lev: 'LEV', Num: 'NUM', Deut: 'DEU', Josh: 'JOS', Judg: 'JDG', Ruth: 'RUT',
  '1Sam': '1SA', '2Sam': '2SA', '1Kgs': '1KI', '2Kgs': '2KI', '1Chr': '1CH', '2Chr': '2CH', Ezra: 'EZR',
  Neh: 'NEH', Esth: 'EST', Job: 'JOB', Ps: 'PSA', Prov: 'PRO', Eccl: 'ECC', Song: 'SNG', Isa: 'ISA',
  Jer: 'JER', Lam: 'LAM', Ezek: 'EZK', Dan: 'DAN', Hos: 'HOS', Joel: 'JOL', Amos: 'AMO', Obad: 'OBA',
  Jonah: 'JON', Mic: 'MIC', Nah: 'NAM', Hab: 'HAB', Zeph: 'ZEP', Hag: 'HAG', Zech: 'ZEC', Mal: 'MAL',
  Matt: 'MAT', Mark: 'MRK', Luke: 'LUK', John: 'JHN', Acts: 'ACT', Rom: 'ROM', '1Cor': '1CO', '2Cor': '2CO',
  Gal: 'GAL', Eph: 'EPH', Phil: 'PHP', Col: 'COL', '1Thess': '1TH', '2Thess': '2TH', '1Tim': '1TI',
  '2Tim': '2TI', Titus: 'TIT', Phlm: 'PHM', Heb: 'HEB', Jas: 'JAS', '1Pet': '1PE', '2Pet': '2PE',
  '1John': '1JN', '2John': '2JN', '3John': '3JN', Jude: 'JUD', Rev: 'REV',
};

function decodeXmlText(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .trim();
}

function parseOsisSource(source) {
  const byReference = new Map();
  const versePattern = /<verse\s+osisID='([^']+)'[^>]*>([\s\S]*?)<\/verse>/g;

  for (const match of source.matchAll(versePattern)) {
    const [osisBook, chapterRaw, verseRaw] = match[1].split('.');
    const bookCode = OSIS_CODE_MAP[osisBook];
    const textContent = decodeXmlText(match[2]);
    if (!bookCode || !textContent || /<[^>]+>/.test(textContent)) {
      throw new Error(`Unsupported OSIS verse: ${match[1]}`);
    }
    const reference = `${bookCode}.${chapterRaw}.${verseRaw}`;
    // This source contains one duplicated, mislabelled Chronicles block and a
    // corrected 1 Chronicles block at EOF. Last-write wins preserves the
    // canonical 1/2 Chronicles references without altering Scripture text.
    byReference.set(reference, {
      bookCode,
      chapter: Number(chapterRaw),
      verse: Number(verseRaw),
      textContent,
    });
  }

  return [...byReference.values()];
}

function parseVplSource(source) {
  const allowedBooks = new Set(BOOKS.map(([code]) => code));
  const seen = new Set();
  const verses = [];

  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = /^([1-3A-Z]{3}) (\d{1,3}):(\d{1,3}) (.*)$/.exec(line);
    if (!match) throw new Error(`Unrecognized VPL line near verse ${verses.length + 1}`);
    const [, sourceBookCode, chapterRaw, verseRaw, textContent] = match;
    if (!textContent) continue;
    const bookCode = SOURCE_CODE_MAP[sourceBookCode] ?? sourceBookCode;
    if (!allowedBooks.has(bookCode)) throw new Error(`Unexpected book code: ${bookCode}`);
    const reference = `${bookCode}.${chapterRaw}.${verseRaw}`;
    if (seen.has(reference)) throw new Error(`Duplicate reference: ${reference}`);
    seen.add(reference);
    verses.push({ bookCode, chapter: Number(chapterRaw), verse: Number(verseRaw), textContent });
  }

  return verses;
}

function parseSource(source) {
  const verses = CORPUS.sourceFormat === 'osis' ? parseOsisSource(source) : parseVplSource(source);
  if (verses.length !== CORPUS.expectedVerseCount) {
    throw new Error(`Expected ${CORPUS.expectedVerseCount} verses, received ${verses.length}`);
  }
  if (new Set(verses.map((verse) => verse.bookCode)).size !== BOOKS.length) {
    throw new Error('The source does not contain all 66 protocanonical books');
  }
  return verses;
}

async function upsertInBatches(supabase, table, rows, onConflict, batchSize = 400) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    let lastError = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const { error } = await supabase.from(table).upsert(batch, { onConflict });
      if (!error) {
        lastError = null;
        break;
      }
      lastError = error;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** (attempt - 1))));
    }
    if (lastError) throw new Error(`${table} upsert failed at ${start}: ${lastError.message}`);
    if (table === 'bible_verses' && (start === 0 || start + batch.length === rows.length || start % 4_000 === 0)) {
      console.info(`[corpus] imported ${start + batch.length}/${rows.length}`);
    }
  }
}

async function main() {
  const shouldApply = process.argv.includes('--apply');
  const shouldCheck = process.argv.includes('--check');
  if (!shouldApply && !shouldCheck) {
    throw new Error('Use --check to validate a corpus or --apply to import it');
  }

  const sourcePath = requiredEnv('SOURCE_FILE');
  const sourceBuffer = await readFile(sourcePath);
  const actualSha256 = createHash('sha256').update(sourceBuffer).digest('hex');
  if (actualSha256 !== CORPUS.sha256) {
    throw new Error(`Source checksum mismatch: ${actualSha256}`);
  }
  const verses = parseSource(sourceBuffer.toString('utf8'));

  if (!shouldApply) {
    console.info(JSON.stringify({
      status: 'valid',
      edition: CORPUS_CODE,
      verses: verses.length,
      books: BOOKS.length,
      source: CORPUS.sourceUrl,
      sha256: actualSha256,
    }, null, 2));
    return;
  }

  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false }, db: { schema: requiredEnv('SUPABASE_DB_SCHEMA') } },
  );

  await upsertInBatches(supabase, 'bible_versions', [{
    code: CORPUS_CODE,
    language_code: CORPUS.languageCode,
    name: CORPUS.name,
    provider: `${CORPUS.sourceProvider ?? 'eBible.org'} · ${CORPUS.rightsLabel} · ${CORPUS.rightsUrl}`,
    is_active: CORPUS.isActive ?? true,
  }], 'code');

  await upsertInBatches(supabase, 'bible_books', BOOKS.map(([code], index) => ({
    code,
    canonical_order: index + 1,
    testament: index < 39 ? 'old' : 'new',
  })), 'code');

  const [{ data: versions, error: versionError }, { data: books, error: bookError }] = await Promise.all([
    supabase.from('bible_versions').select('id, code').eq('code', CORPUS_CODE).limit(1),
    supabase.from('bible_books').select('id, code').in('code', BOOKS.map(([code]) => code)),
  ]);
  if (versionError || !versions?.[0]) throw new Error(`${CORPUS_CODE} version lookup failed: ${versionError?.message ?? 'missing row'}`);
  if (bookError || books?.length !== BOOKS.length) throw new Error(`Book lookup failed: ${bookError?.message ?? books?.length}`);

  const bookIds = new Map(books.map((book) => [book.code, book.id]));
  if (CORPUS.languageCode === 'en') {
    const bookNames = new Map(BOOKS);
    await upsertInBatches(supabase, 'bible_book_translations', books.map((book) => ({
      book_id: book.id,
      language_code: 'en',
      name: bookNames.get(book.code),
      short_name: book.code,
    })), 'book_id,language_code');
  }

  await upsertInBatches(supabase, 'bible_verses', verses.map((verse) => ({
    version_id: versions[0].id,
    book_id: bookIds.get(verse.bookCode),
    chapter: verse.chapter,
    verse: verse.verse,
    text_content: verse.textContent,
    language_code: CORPUS.languageCode,
  })), 'version_id,book_id,chapter,verse');

  const { count, error: countError } = await supabase
    .from('bible_verses')
    .select('id', { count: 'exact', head: true })
    .eq('version_id', versions[0].id);
  if (countError || count !== CORPUS.expectedVerseCount) {
    throw new Error(`Post-import count check failed: ${countError?.message ?? count}`);
  }

  if (CORPUS.replacesCodes?.length) {
    const { error: replacementError } = await supabase
      .from('bible_versions')
      .update({ is_active: false })
      .in('code', CORPUS.replacesCodes);
    if (replacementError) throw new Error(`Superseded edition deactivation failed: ${replacementError.message}`);
  }

  console.info(JSON.stringify({
    status: 'ok',
    edition: CORPUS_CODE,
    verses: count,
    books: BOOKS.length,
    source: CORPUS.sourceUrl,
    sha256: actualSha256,
  }, null, 2));
}

await main();
