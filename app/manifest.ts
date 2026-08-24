import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vella',
    short_name: 'Vella',
    description: 'Vella',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf8f1',
    theme_color: '#071225',
    orientation: 'portrait',
    categories: ['lifestyle', 'education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
