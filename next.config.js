/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/support',
        destination: '/setup#support',
        permanent: false,
      },
      {
        source: '/api/auth/signin',
        destination: '/auth/discord',
        permanent: false,
      },
    ];
  },
  async headers() {
    // These assets change infrequently; edits may take a week to reach repeat visitors.
    return ['/doodle/:path*', '/doodles/:path*', '/icon.svg'].map(
      (source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
      }),
    );
  },
  // Compress large dashboard responses when running the Node server directly.
  compress: true,
  // Drops the `x-powered-by: Next.js` header.
  poweredByHeader: false,
  images: {
    // AVIF first, WebP where AVIF is not taken: avatars, server icons and
    // Roblox pictures arrive at a fraction of their PNG weight.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
};

module.exports = nextConfig;
