import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateVerseNarration,
  resolveVerseNarrationVoice,
} from '../lib/verseNarration';

describe('verse narration', () => {
  afterEach(() => vi.useRealTimers());

  it('uses a curated natural voice and a closed preference contract', () => {
    expect(resolveVerseNarrationVoice(null)).toBe('marin');
    expect(resolveVerseNarrationVoice('vella-neural:marin')).toBe('marin');
    expect(resolveVerseNarrationVoice('vella-neural:cedar')).toBe('cedar');
    expect(resolveVerseNarrationVoice('com.apple.voice.samantha.compact')).toBe('marin');
    expect(resolveVerseNarrationVoice('unknown')).toBe('marin');
  });

  it('sends only approved Scripture text with a natural reading instruction', async () => {
    const audio = new Uint8Array(2_048).fill(7);
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        model: 'gpt-4o-mini-tts',
        voice: 'marin',
        input: 'Porque Deus amou o mundo.',
        instructions: expect.stringContaining('Brazilian Portuguese'),
        response_format: 'mp3',
        speed: 0.96,
      });
      expect(JSON.stringify(body)).not.toContain('user_id');
      expect(JSON.stringify(body)).not.toContain('prayer');
      return new Response(audio, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      });
    });

    const result = await generateVerseNarration({
      apiKey: 'test-key',
      fetchImpl: fetchImpl as typeof fetch,
      language: 'pt-BR',
      text: 'Porque Deus amou o mundo.',
      voice: 'marin',
    });

    expect(result.byteLength).toBe(2_048);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('fails closed for invalid upstream content and oversized input', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"no"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(generateVerseNarration({
      apiKey: 'test-key',
      fetchImpl: fetchImpl as typeof fetch,
      language: 'en',
      text: 'For God so loved the world.',
      voice: 'cedar',
    })).rejects.toThrow('invalid_audio_response');

    await expect(generateVerseNarration({
      apiKey: 'test-key',
      fetchImpl: fetchImpl as typeof fetch,
      language: 'en',
      text: 'x'.repeat(4_097),
      voice: 'marin',
    })).rejects.toThrow('invalid_narration_input');
  });

  it('aborts a stalled speech provider before the route deadline', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = generateVerseNarration({
      apiKey: 'test-key',
      fetchImpl: fetchImpl as typeof fetch,
      language: 'en',
      text: 'Be still.',
      voice: 'marin',
    });
    const rejection = expect(pending).rejects.toThrow('provider_timeout');

    await vi.advanceTimersByTimeAsync(15_001);
    await rejection;
  });
});
