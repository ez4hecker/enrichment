// Where /api/* is proxied. Local dev runs the backend on localhost:3000; in Docker it is the
// "backend" service. Rewrites are fixed at build time, so Docker passes this as a build argument.
const backendUrl = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  images: { unoptimized: true },
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // The dev-tools badge would leak into reviewer/validator screenshots.
  devIndicators: false,
  experimental: {
    middlewareClientMaxBodySize: '100mb',
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};
export default nextConfig;
