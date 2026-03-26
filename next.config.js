/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://www.paypal.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.openai.com https://api-m.paypal.com https://api-m.sandbox.paypal.com",
      "frame-src 'self' https://www.paypal.com",
      "frame-ancestors 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  headers: async () => [
    {
      // Apply security headers to all routes
      source: '/:path*',
      headers: securityHeaders,
    },
    {
      source: '/embed.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=86400' },
        { key: 'Access-Control-Allow-Origin', value: '*' },
      ],
    },
    {
      source: '/manifest.json',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
    },
    {
      source: '/api/agents/templates',
      headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }],
    },
    {
      source: '/api/admin/knowledge/stats',
      headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' }],
    },
    {
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

module.exports = nextConfig
