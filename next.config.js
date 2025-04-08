/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large image responses
  api: {
    responseLimit: '50mb',
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  
  // Configure image handling
  images: {
    domains: ['localhost'],
    unoptimized: true,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Increase memory limits
  experimental: {
    isrMemoryCacheSize: 150 * 1024 * 1024, // 150MB
    serverActions: true,
  },
  
  // External packages that should be treated as dependencies
  serverExternalPackages: ['fs', 'path', 'os'],
  
  // Optional: Configure headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' }
        ],
      },
    ];
  },
};

module.exports = nextConfig;