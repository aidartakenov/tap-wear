import type { MetadataRoute } from 'next';

// Lets a phone add TapWear to its home screen and open it full-screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TapWear — каталог одежды',
    short_name: 'TapWear',
    description: 'Каталог одежды магазинов Кыргызстана с поиском по фото',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f9fafb',
    theme_color: '#ffffff',
    lang: 'ru',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Найти по фото', url: '/search' },
      { name: 'Каталог', url: '/catalog' },
      { name: 'Корзина', url: '/cart' },
    ],
  };
}
