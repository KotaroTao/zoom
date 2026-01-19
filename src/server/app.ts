import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from '../utils/logger.js';
import { webhookRouter } from './routes/webhook.js';
import { apiRouter } from './routes/api.js';

/**
 * Express アプリケーション作成
 */
export function createApp(): Express {
  const app = express();

  // CORS設定（ダッシュボードからのアクセスを許可）
  app.use(cors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'https://tao-dx.com',
    ],
    credentials: true,
  }));

  // JSONパーサー（Webhook署名検証のためraw bodyも保持）
  app.use(
    express.json({
      verify: (req: Request, _res, buf) => {
        // 署名検証用にraw bodyを保存
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // リクエストログ
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // ヘルスチェック
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'zoom-youtube-automation',
    });
  });

  // Webhook ルート
  app.use('/webhook', webhookRouter);

  // Google OAuth コールバック（後で実装）
  app.get('/auth/google/callback', (req: Request, res: Response) => {
    const { code } = req.query;
    if (code) {
      // TODO: OAuth トークン取得処理
      res.send('認証成功！このウィンドウを閉じてください。');
    } else {
      res.status(400).send('認証に失敗しました');
    }
  });

  // API ルート（ダッシュボード用）
  app.use('/api', apiRouter);

  // 404 ハンドラ
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'リクエストされたリソースが見つかりません',
    });
  });

  // エラーハンドラ
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('サーバーエラー', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'サーバーエラーが発生しました',
    });
  });

  return app;
}
