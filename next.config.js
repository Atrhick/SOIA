/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
    ]
  },
  async headers() {
    return [
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
    ]
  },
}

module.exports = nextConfig
