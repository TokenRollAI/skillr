import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
