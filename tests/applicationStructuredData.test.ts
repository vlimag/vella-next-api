import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('public app availability in structured data', () => {
  it.each([
    { ios: 'false', android: 'true', systems: 'Android', downloads: ['https://play.google.com/store/apps/details?id=io.vella.app'] },
    { ios: 'true', android: 'false', systems: 'iOS', downloads: ['https://apps.apple.com/app/id6790616297'] },
    { ios: 'false', android: 'false', systems: '', downloads: [] },
  ])('does not advertise a disabled store (iOS=$ios, Android=$android)', async ({ ios, android, systems, downloads }) => {
    vi.stubEnv('NEXT_PUBLIC_IOS_STORE_AVAILABLE', ios);
    vi.stubEnv('NEXT_PUBLIC_ANDROID_STORE_AVAILABLE', android);
    vi.resetModules();
    const { buildApplicationStructuredData } = await import('@/lib/site/applicationStructuredData');
    const app = buildApplicationStructuredData('pt', 'Aplicativo de Bíblia e oração.', ['Oração privada']);

    expect(app.operatingSystem).toBe(systems);
    expect(app.downloadUrl).toEqual(downloads);
    expect(app.url).toBe('https://vella.one/pt');
  });
});
