/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/support',
        destination: 'https://discord.gg/X87N8qRbzR',
        permanent: true,
      },
      {
        source: '/api/auth/signin',
        destination: '/auth/discord',
        permanent: false,
      },
      {
        source: '/apply',
        destination: 'https://docs.google.com/forms/d/1m2-wmbA1Ctmk-YCi8zQDjZucHX5z18KaVfz0dmBBDCo/viewform',
        permanent: true,
      },
      {
        source: '/qa',
        destination: 'https://ermbot.xyz/1092976553752789054/62b489be-19b1-4e9f-a9ad-32a1cc003fe2/application',
        permanent: true,
      },
    ];
  },
  async headers() {
    // The landing's captures, the brand marks and the doodles change a few
    // times a year: a week fresh, and a month more served stale while a new
    // copy is fetched behind it.
    return ['/modules/:path*', '/brand/:path*', '/doodle/:path*', '/doodles/:path*', '/gator-logo.png'].map(
      (source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
      }),
    );
  },
  output: 'standalone',
  // Stated rather than left to the default, because `standalone` runs the Node
  // server directly: whether responses are compressed is this server's job, not
  // a platform edge's, and the dashboard's payloads are large JSON.
  compress: true,
  // Drops the `x-powered-by: Next.js` header.
  poweredByHeader: false,
  images: {
    // AVIF first, WebP where AVIF is not taken: avatars, server icons and
    // Roblox pictures arrive at a fraction of their PNG weight.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'corsproxy.io' },
      { protocol: 'https', hostname: 'www.roblox.com' },
      { protocol: 'https', hostname: 'thumbnails.roblox.com' },
      { protocol: 'https', hostname: 'tr.rbxcdn.com' },
    ],
  },
};

module.exports = nextConfig;
