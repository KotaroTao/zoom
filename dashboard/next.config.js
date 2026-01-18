/** @type {import('next').NextConfig} */
const nextConfig = {
  // /zoom/ パスで動作するように設定
  basePath: '/zoom',

  // 静的アセットのパス
  assetPrefix: '/zoom',

  // 本番ビルド設定
  output: 'standalone',

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
