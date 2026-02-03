/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/trainlog',
  assetPrefix: '/trainlog',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/trainlog'
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  }
};

module.exports = nextConfig;
