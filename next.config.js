/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compress responses
  compress: true,
  // Cache static assets aggressively
  headers: async () => [
    {
      source: '/embed.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=86400' },
        { key: 'Access-Control-Allow-Origin', value: '*' },
      ],
    },
    {
      source: '/manifest.json',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=86400' },
      ],
    },
    {
      source: '/api/agents/templates',
      headers: [
        // Cache template list for 5 minutes (they rarely change)
        { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' },
      ],
    },
    {
      source: '/api/admin/knowledge/stats',
      headers: [
        { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' },
      ],
    },
    {
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ],
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

module.exports = nextConfig
