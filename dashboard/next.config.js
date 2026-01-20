/** @type {import('next').NextConfig} */
const nextConfig = {
  // /zoom/ パスで動作するように設定
  basePath: '/zoom',

  // 静的アセットのパス
  assetPrefix: '/zoom',

  // 本番ビルド設定
  output: 'standalone',

  // トレイリングスラッシュを有効化（一貫したURL処理のため）
  trailingSlash: false,

  // バックエンドAPIへのプロキシ & OAuth callbackリダイレクト
  async rewrites() {
    return [
      // OAuth callback を正しいパスにリダイレクト
      {
        source: '/callback/:provider',
        destination: '/api/auth/callback/:provider',
      },
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
