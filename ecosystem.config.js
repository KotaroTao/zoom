/**
 * PM2 設定ファイル
 *
 * 使用方法:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 */

module.exports = {
  apps: [
    // バックエンドサーバー（Webhook受信 + ワーカー）
    {
      name: 'zoom-backend',
      script: 'dist/index.js',
      cwd: '/var/www/zoom',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '/var/www/zoom/.env',
      error_file: '/var/log/pm2/zoom-backend-error.log',
      out_file: '/var/log/pm2/zoom-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },

    // ダッシュボード（Next.js）
    {
      name: 'zoom-dashboard',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      cwd: '/var/www/zoom/dashboard',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/zoom-dashboard-error.log',
      out_file: '/var/log/pm2/zoom-dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '300M',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
