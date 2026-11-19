// One id per build. The page keeps the id it loaded with; /api/version reports the live one, so a
// home-screen app that was only paused can tell a new version is out (AppUpdateWatcher).
const APP_VERSION = process.env.APP_VERSION || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
// next build loads this file several times (and in worker processes), each a few seconds or minutes
// apart. Without this line each load made its own timestamp, so the page and /api/version never matched
// and every open app kept saying "A new version of the app is ready". Workers inherit process.env.
process.env.APP_VERSION = APP_VERSION

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  generateBuildId: async () => APP_VERSION,
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  // Local only: lets several dev servers run side by side (NEXT_DIST_DIR=.next-a). Production uses .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // People who open the old Cloud Run address land on the real domain. /api is left alone so the
  // reminder job (Cloud Scheduler calls run.app) and webhooks keep working; /_next for assets.
  async redirects() {
    return [
      {
        source: '/:path((?!api/|_next/).*)',
        has: [{ type: 'host', value: 'soia-816056420126.us-central1.run.app' }],
        destination: 'https://www.nowtransformedleadership.com/:path',
        permanent: false,
      },
      // The ExploreNation program's address was "talent-acquisition" until 2026-11-16; links already shared keep working.
      { source: '/join/:owner/talent-acquisition', destination: '/join/:owner/explorenation', permanent: true },
      { source: '/p/talent-acquisition/:rest*', destination: '/p/explorenation/:rest*', permanent: true },
    ]
  },
  async headers() {
    return [
      // The service worker must never be served from a cache, or phones keep an old one.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // The program page preview frame is shown scaled inside our own screens (ScaledPreviewFrame), so it
      // may be framed by this site only. Listed last: for the same key, the last matching rule wins.
      {
        source: '/page-preview/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
