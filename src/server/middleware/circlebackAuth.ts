/**
 * Circleback Webhook署名検証ミドルウェア
 *
 * Circlebackはx-signatureヘッダーでHMAC-SHA256署名を送信する
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getCredentials } from '../../utils/credentials.js';
import { logger } from '../../utils/logger.js';

export async function verifyCirclebackSignature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const signature = req.headers['x-signature'] as string;

    if (!signature) {
      logger.warn('Circleback Webhook: 署名ヘッダーがありません');
      res.status(401).json({ error: 'Missing x-signature header' });
      return;
    }

    const credentials = await getCredentials();
    const secret = credentials.circlebackWebhookSecret;

    if (!secret) {
      logger.error('Circleback Webhook: Secretが設定されていません');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    // リクエストボディからHMAC-SHA256署名を計算
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // 署名を比較（タイミング攻撃対策）
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('Circleback Webhook: 署名が一致しません', {
        received: signature.substring(0, 10) + '...',
      });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    logger.debug('Circleback Webhook: 署名検証成功');
    next();
  } catch (error) {
    logger.error('Circleback Webhook: 署名検証エラー', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Signature verification failed' });
  }
}
