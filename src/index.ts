/**
 * Zoom YouTube Automation - エントリーポイント
 *
 * Zoomクラウド録画を自動処理するアプリケーション:
 * 1. Zoom Webhook で録画完了を検知
 * 2. YouTube に限定公開でアップロード
 * 3. Whisper で文字起こし
 * 4. GPT で要約生成
 * 5. Google Sheets / Notion に記録
 */

import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { ensureTempDir, cleanupOldTempFiles } from './utils/fileManager.js';
import { createApp } from './server/app.js';
import { startWorker } from './queue/worker.js';

async function main(): Promise<void> {
  logger.info('='.repeat(50));
  logger.info('Zoom YouTube Automation 起動中...');
  logger.info('='.repeat(50));

  try {
    // 一時ディレクトリの初期化
    await ensureTempDir();
    logger.info('一時ディレクトリを初期化しました');

    // 古い一時ファイルのクリーンアップ
    await cleanupOldTempFiles();

    // Express サーバー起動
    const app = createApp();
    app.listen(config.server.port, () => {
      logger.info(`Webhook サーバー起動: http://localhost:${config.server.port}`);
      logger.info(`  - Webhook エンドポイント: POST /webhook/zoom`);
      logger.info(`  - ヘルスチェック: GET /health`);
    });

    // BullMQ ワーカー起動
    await startWorker();
    logger.info('ジョブワーカーを起動しました');

    // 定期的な一時ファイルクリーンアップ（1時間ごと）
    setInterval(
      () => {
        cleanupOldTempFiles().catch((error) => {
          logger.error('定期クリーンアップに失敗', { error });
        });
      },
      60 * 60 * 1000
    );

    logger.info('='.repeat(50));
    logger.info('システム起動完了 - Webhook待機中');
    logger.info('='.repeat(50));

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} シグナル受信 - シャットダウン開始`);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('起動エラー', { error });
    process.exit(1);
  }
}

// アプリケーション起動
main();
