const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is required for the Docker/Fly.io image. Only enable when building for deploy
  // so local dev and CI (npm run build) are unchanged. Dockerfile sets BUILD_STANDALONE=1.
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' } : {}),

  // CDN-friendly cache headers (see docs/CDN_SETUP.md)
  // - _next/static: Next.js sets public, max-age=31536000, immutable by default
  // - /api/*: must bypass CDN cache; set no-store so Cloudflare/Fly edge won't cache
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private',
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin logs are too noisy for regular builds.
  silent: true,
  // Upload a broader set of source maps in production for better stack traces.
  widenClientFileUpload: true,
  // Source map upload settings (enabled when auth token is provided in build env).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
