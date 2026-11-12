import type { MetadataRoute } from 'next'

// Lets people add the back office to their phone's home screen; it then opens full screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'NowTransformed Back Office',
    short_name: 'NowTransformed',
    description: 'Coach, ambassador and admin portal for NowTransformed',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/brand/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
