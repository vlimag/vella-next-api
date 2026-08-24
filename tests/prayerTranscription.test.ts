import { describe, expect, it } from 'vitest';
import {
  normalizePrayerAudioFile,
  normalizePrayerLanguage,
  prayerAudioExtension,
} from '@/lib/prayerTranscription';

describe('prayer transcription input normalization', () => {
  it('normalizes supported app languages to ISO 639-1', () => {
    expect(normalizePrayerLanguage('pt-BR')).toBe('pt');
    expect(normalizePrayerLanguage('de_DE')).toBe('de');
    expect(normalizePrayerLanguage('ja')).toBeUndefined();
  });

  it('keeps the iOS and Android m4a recording container as audio/mp4', () => {
    const file = new File(['audio'], 'recording.m4a', { type: 'audio/x-m4a' });
    expect(prayerAudioExtension(file)).toBe('m4a');
    const normalized = normalizePrayerAudioFile(file);
    expect(normalized.name).toBe('prayer-recording.m4a');
    expect(normalized.type).toBe('audio/mp4');
  });

  it('rejects unsupported containers before calling the provider', () => {
    const file = new File(['audio'], 'recording.aac', { type: 'audio/aac' });
    expect(() => normalizePrayerAudioFile(file)).toThrow('Unsupported audio format');
  });
});
