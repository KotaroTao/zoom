/** @type {import('next').NextConfig} */
const nextConfig = {
  // バックエンドAPIへのプロキシ
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
