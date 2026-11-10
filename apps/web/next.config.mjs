import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mehfil/shared'],
  // Self-contained server bundle for Docker/Railway deploys.
  output: 'standalone',
  // Monorepo: trace files from the repo root so @mehfil/shared is included.
  outputFileTracingRoot: join(__dirname, '../../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  async rewrites() {
    // Proxy API calls in dev so the browser talks to a single origin.
    const api = process.env.NEXT_PUBLIC_API_PROXY_TARGET;
    if (!api) return [];
    return [
      {
        source: '/api/backend/:path*',
        destination: `${api}/:path*`,
      },
    ];
  },
};

export default nextConfig;
