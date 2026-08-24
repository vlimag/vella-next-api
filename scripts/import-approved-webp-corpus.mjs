import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const CORPORA = {
  WEBP: {
    sha256: 'e94393e5090704abba7233773be8df546f4fa35eebc3a40e84da8bd5e8f9af8d',
    sourceUrl: 'https://ebible.org/Scriptures/engwebp_vpl.zip',
    rightsUrl: 'https://ebible.org/engwebp/copyright.htm',
    languageCode: 'en',
    name: 'World English Bible',
  },
  BPM: {
    sha256: 'a98e7b7d3f977b80716a5a7ecd443ece474593ca3d1770cf278a448b37b97287',
    sourceUrl: 'https://ebible.org/Scriptures/porbrbsl_vpl.zip',
    rightsUrl: 'https://ebible.org/porbrbsl/copyright.htm',
    languageCode: 'pt',
    name: 'Bíblia Portuguesa Mundial',
  },
};
const CORPUS_CODE = process.env.CORPUS_CODE ?? 'WEBP';
const CORPUS = CORPORA[CORPUS_CODE];
if (!CORPUS) throw new Error(`Unsupported approved corpus: ${CORPUS_CODE}`);
// The VPL source has five intentionally empty KJV-tradition verse slots. They
// are excluded because Vella never stores or displays empty Scripture text.
const EXPECTED_VERSE_COUNT = 31_098;

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

function parseSource(source) {
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

  if (verses.length !== EXPECTED_VERSE_COUNT) {
    throw new Error(`Expected ${EXPECTED_VERSE_COUNT} verses, received ${verses.length}`);
  }
  if (new Set(verses.map((verse) => verse.bookCode)).size !== BOOKS.length) {
    throw new Error('The source does not contain all 66 protocanonical books');
  }
  return verses;
}

async function upsertInBatches(supabase, table, rows, onConflict, batchSize = 400) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} upsert failed at ${start}: ${error.message}`);
    if (table === 'bible_verses' && (start === 0 || start + batch.length === rows.length || start % 4_000 === 0)) {
      console.info(`[corpus] imported ${start + batch.length}/${rows.length}`);
    }
  }
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Refusing to mutate production without --apply');
  }

  const sourcePath = requiredEnv('SOURCE_FILE');
  const sourceBuffer = await readFile(sourcePath);
  const actualSha256 = createHash('sha256').update(sourceBuffer).digest('hex');
  if (actualSha256 !== CORPUS.sha256) {
    throw new Error(`Source checksum mismatch: ${actualSha256}`);
  }
  const verses = parseSource(sourceBuffer.toString('utf8'));

  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false }, db: { schema: requiredEnv('SUPABASE_DB_SCHEMA') } },
  );

  await upsertInBatches(supabase, 'bible_versions', [{
    code: CORPUS_CODE,
    language_code: CORPUS.languageCode,
    name: CORPUS.name,
    provider: `eBible.org · Public Domain · ${CORPUS.rightsUrl}`,
    is_active: true,
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
  if (countError || count !== EXPECTED_VERSE_COUNT) {
    throw new Error(`Post-import count check failed: ${countError?.message ?? count}`);
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
