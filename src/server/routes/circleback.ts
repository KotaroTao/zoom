/**
 * Circleback Webhook受信ルート
 *
 * POST /webhook/circleback
 *
 * CirclebackのAutomationsから送信される議事録データを受信し、
 * 対応するRecordingと紐付けて同期処理を実行する
 */

import { Router, Request, Response } from 'express';
import { verifyCirclebackSignature } from '../middleware/circlebackAuth.js';
import {
  matchRecording,
  updateWithCirclebackData,
  executeSyncStep,
  type CirclebackPayload,
} from '../../services/circleback/index.js';
import { logger } from '../../utils/logger.js';
import { getCredentials } from '../../utils/credentials.js';

const router = Router();

/**
 * Circleback Webhook受信エンドポイント
 *
 * ペイロード例:
 * {
 *   "id": 12345,
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "notes": "# Meeting Notes\n\n## Discussion...",
 *   "actionItems": [{"text": "Follow up", "assignee": "John"}],
 *   "recordingUrl": "https://...",
 *   "tags": ["sales", "demo"],
 *   "icalUid": "xxx@google.com"
 * }
 */
router.post(
  '/',
  verifyCirclebackSignature,
  async (req: Request, res: Response): Promise<void> => {
    const payload: CirclebackPayload = req.body;

    logger.info('Circleback Webhook受信', {
      circlebackId: payload.id,
      email: payload.email,
      notesLength: payload.notes?.length || 0,
      actionItemsCount: payload.actionItems?.length || 0,
    });

    try {
      // Circleback連携が有効か確認
      const credentials = await getCredentials();
      if (!credentials.circlebackEnabled) {
        logger.warn('Circleback: 連携が無効です');
        res.status(200).json({
          status: 'ignored',
          reason: 'Circleback integration is disabled',
        });
        return;
      }

      // 1. Recording検索（email + 日付でマッチング）
      const recording = await matchRecording(payload);

      if (!recording) {
        // マッチしない場合はログのみ（200を返してCirclebackにリトライさせない）
        logger.warn('Circleback: マッチするRecordingがありません', {
          email: payload.email,
          circlebackId: payload.id,
        });
        res.status(200).json({
          status: 'no_match',
          message: 'No matching recording found',
        });
        return;
      }

      // 2. RecordingをCirclebackデータで更新
      await updateWithCirclebackData(recording.id, {
        circlebackMeetingId: String(payload.id),
        circlebackNotes: payload.notes || '',
        circlebackActionItems: payload.actionItems || [],
        circlebackRecordingUrl: payload.recordingUrl,
      });

      // 3. ステータスがWAITING_CIRCLEBACKなら同期実行
      if (recording.status === 'WAITING_CIRCLEBACK') {
        // 非同期で同期処理を実行（Webhookレスポンスをブロックしない）
        executeSyncStep(recording.id).catch((error) => {
          logger.error('Circleback: 同期処理エラー（非同期）', {
            recordingId: recording.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      } else {
        logger.info('Circleback: Recording更新のみ（同期はスキップ）', {
          recordingId: recording.id,
          currentStatus: recording.status,
        });
      }

      res.status(200).json({
        status: 'ok',
        recordingId: recording.id,
        title: recording.title,
      });
    } catch (error) {
      logger.error('Circleback Webhookエラー', {
        error: error instanceof Error ? error.message : String(error),
        circlebackId: payload.id,
      });

      // エラーでも200を返す（リトライを防ぐ）
      res.status(200).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Webhook疎通確認（GET）
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Circleback Webhook',
    message: 'Use POST to send webhook data',
  });
});

export default router;
