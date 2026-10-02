/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server for the production container image.
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
