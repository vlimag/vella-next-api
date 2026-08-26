import { describe, expect, it, vi } from 'vitest';
import {
  createVerseNarrationCacheKey,
  getOrCreateVerseNarration,
} from '../lib/verseNarrationCache';

const audio = new Uint8Array(2_048).fill(7).buffer;

function storageWith({
  cached = null,
  downloadError = null,
  uploadError = null,
}: {
  cached?: ArrayBuffer | null;
  downloadError?: { message: string; statusCode?: string } | null;
  uploadError?: { message: string; statusCode?: string } | null;
} = {}) {
  const download = vi.fn(async () => ({
    data: cached ? new Blob([cached], { type: 'audio/mpeg' }) : null,
    error: downloadError,
  }));
  const upload = vi.fn(async () => ({ data: uploadError ? null : {}, error: uploadError }));
  const from = vi.fn(() => ({ download, upload }));
  return { storage: { from }, from, download, upload };
}

const request = {
  language: 'pt-BR',
  text: 'O Senhor é o meu pastor.',
  voice: 'marin' as const,
};

describe('shared verse narration cache', () => {
  it('uses a content-addressed key that contains no Scripture text', () => {
    const key = createVerseNarrationCacheKey(request);

    expect(key).toMatch(/^v1\/pt\/marin\/[a-f0-9]{64}\.mp3$/);
    expect(key).not.toContain('Senhor');
    expect(createVerseNarrationCacheKey(request)).toBe(key);
    expect(createVerseNarrationCacheKey({ ...request, voice: 'cedar' })).not.toBe(key);
    expect(createVerseNarrationCacheKey({ ...request, text: `${request.text} Amém.` })).not.toBe(key);
  });

  it('serves a persistent cache hit without calling the speech provider', async () => {
    const store = storageWith({ cached: audio });
    const generate = vi.fn(async () => audio);

    const result = await getOrCreateVerseNarration({ ...request, storage: store.storage, generate });

    expect(result.cacheStatus).toBe('hit');
    expect(result.audio.byteLength).toBe(audio.byteLength);
    expect(generate).not.toHaveBeenCalled();
    expect(store.upload).not.toHaveBeenCalled();
  });

  it('stores a miss privately with immutable metadata and still serves if upload fails', async () => {
    const store = storageWith({
      downloadError: { message: 'Object not found', statusCode: '404' },
      uploadError: { message: 'temporary failure', statusCode: '503' },
    });
    const generate = vi.fn(async () => audio);

    const result = await getOrCreateVerseNarration({ ...request, storage: store.storage, generate });

    expect(result.cacheStatus).toBe('miss');
    expect(result.audio.byteLength).toBe(audio.byteLength);
    expect(generate).toHaveBeenCalledOnce();
    expect(store.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^v1\/pt\/marin\/[a-f0-9]{64}\.mp3$/),
      expect.any(Uint8Array),
      { cacheControl: '31536000', contentType: 'audio/mpeg', upsert: true },
    );
  });

  it('coalesces concurrent misses within one server instance', async () => {
    const store = storageWith({
      downloadError: { message: 'Object not found', statusCode: '404' },
    });
    let release!: (value: ArrayBuffer) => void;
    const generation = new Promise<ArrayBuffer>((resolve) => { release = resolve; });
    const generate = vi.fn(() => generation);

    const first = getOrCreateVerseNarration({ ...request, storage: store.storage, generate });
    const second = getOrCreateVerseNarration({ ...request, storage: store.storage, generate });
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
    release(audio);

    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.cacheStatus).sort()).toEqual(['miss', 'shared']);
    expect(generate).toHaveBeenCalledOnce();
  });
});
