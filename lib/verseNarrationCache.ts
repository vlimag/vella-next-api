import { createHash } from 'node:crypto';
import {
  isValidVerseNarrationAudio,
  VERSE_NARRATION_MODEL,
  type VerseNarrationVoice,
} from '@/lib/verseNarration';

export const VERSE_NARRATION_CACHE_BUCKET = 'verse-narration-cache';
const CACHE_VERSION = 'v1';
const CACHE_CONTROL_SECONDS = '31536000';

type StorageError = { message?: string; statusCode?: number | string } | null;

export type VerseNarrationStorage = {
  from(bucket: string): {
    download(path: string): Promise<{ data: Blob | null; error: StorageError }>;
    upload(
      path: string,
      body: Uint8Array,
      options: { cacheControl: string; contentType: string; upsert: boolean },
    ): Promise<{ data: unknown; error: StorageError }>;
  };
};

type NarrationRequest = {
  language: string;
  text: string;
  voice: VerseNarrationVoice;
};

export type VersionedNarrationRequest = NarrationRequest & {
  namespace: 'gathering';
  contentVersion: string;
  instructionsVersion: string;
};

type CachedNarrationRequest = NarrationRequest & {
  storage: VerseNarrationStorage;
  generate: () => Promise<ArrayBuffer>;
};

type CacheStatus = 'hit' | 'miss' | 'shared';

const inFlightGenerations = new Map<string, Promise<ArrayBuffer>>();

function normalizedLanguage(language: string) {
  return language.trim().toLowerCase().replace('_', '-').split('-')[0] || 'en';
}

export function createVerseNarrationCacheKey({ language, text, voice }: NarrationRequest) {
  const languageCode = normalizedLanguage(language);
  const digest = createHash('sha256')
    .update(JSON.stringify({
      cache: CACHE_VERSION,
      instructions: 'calm-scripture-v1',
      language: languageCode,
      model: VERSE_NARRATION_MODEL,
      speed: 0.96,
      text: text.trim(),
      voice,
    }))
    .digest('hex');

  return `${CACHE_VERSION}/${languageCode}/${voice}/${digest}.mp3`;
}

export function createVersionedNarrationCacheKey({
  namespace,
  contentVersion,
  instructionsVersion,
  language,
  text,
  voice,
}: VersionedNarrationRequest) {
  const languageCode = normalizedLanguage(language);
  const digest = createHash('sha256')
    .update(JSON.stringify({
      cache: CACHE_VERSION,
      contentVersion,
      instructionsVersion,
      language: languageCode,
      model: VERSE_NARRATION_MODEL,
      speed: 0.96,
      text: text.trim(),
      voice,
    }))
    .digest('hex');

  return `${CACHE_VERSION}/${namespace}/${languageCode}/${voice}/${digest}.mp3`;
}

async function readCachedAudio(storage: VerseNarrationStorage, path: string) {
  try {
    const { data, error } = await storage.from(VERSE_NARRATION_CACHE_BUCKET).download(path);
    if (error || !data) return null;
    const bytes = await data.arrayBuffer();
    return isValidVerseNarrationAudio(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

async function persistAudio(storage: VerseNarrationStorage, path: string, audio: ArrayBuffer) {
  try {
    await storage.from(VERSE_NARRATION_CACHE_BUCKET).upload(path, new Uint8Array(audio), {
      cacheControl: CACHE_CONTROL_SECONDS,
      contentType: 'audio/mpeg',
      upsert: true,
    });
  } catch {
    // Cache availability must never block paid narration playback.
  }
}

export async function getOrCreateVerseNarration({
  storage,
  generate,
  ...request
}: CachedNarrationRequest): Promise<{ audio: ArrayBuffer; cacheStatus: CacheStatus }> {
  const path = createVerseNarrationCacheKey(request);
  const cached = await readCachedAudio(storage, path);
  if (cached) return { audio: cached, cacheStatus: 'hit' };

  const existingGeneration = inFlightGenerations.get(path);
  if (existingGeneration) {
    return { audio: await existingGeneration, cacheStatus: 'shared' };
  }

  const generation = (async () => {
    const audio = await generate();
    if (!isValidVerseNarrationAudio(audio)) throw new Error('invalid_audio_response');
    await persistAudio(storage, path, audio);
    return audio;
  })();
  inFlightGenerations.set(path, generation);

  try {
    return { audio: await generation, cacheStatus: 'miss' };
  } finally {
    if (inFlightGenerations.get(path) === generation) inFlightGenerations.delete(path);
  }
}


export async function getOrCreateVersionedNarration({
  storage,
  generate,
  ...request
}: VersionedNarrationRequest & {
  storage: VerseNarrationStorage;
  generate: () => Promise<ArrayBuffer>;
}): Promise<{ audio: ArrayBuffer; cacheStatus: CacheStatus }> {
  const path = createVersionedNarrationCacheKey(request);
  const cached = await readCachedAudio(storage, path);
  if (cached) return { audio: cached, cacheStatus: 'hit' };

  const existingGeneration = inFlightGenerations.get(path);
  if (existingGeneration) {
    return { audio: await existingGeneration, cacheStatus: 'shared' };
  }

  const generation = (async () => {
    const audio = await generate();
    if (!isValidVerseNarrationAudio(audio)) throw new Error('invalid_audio_response');
    await persistAudio(storage, path, audio);
    return audio;
  })();
  inFlightGenerations.set(path, generation);

  try {
    return { audio: await generation, cacheStatus: 'miss' };
  } finally {
    if (inFlightGenerations.get(path) === generation) inFlightGenerations.delete(path);
  }
}
