import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import { getZoomCredentials } from '../../services/credentials/index.js';
import { logger, webhookLogger } from '../../utils/logger.js';
import { extractClientName } from '../../utils/clientParser.js';
import { addProcessingJob } from '../../queue/worker.js';
import { prisma } from '../../utils/db.js';
import type { ZoomWebhookPayload, ZoomRecordingFile } from '../../types/index.js';
import {
  verifyCirclebackWebhook,
  parseWebhookPayload,
  saveCirclebackMeeting,
  type CirclebackWebhookPayload,
} from '../../services/circleback/index.js';

/**
 * Zoom URLからミーティングIDを抽出
 */
function extractMeetingIdFromUrl(url: string): string | null {
  if (!url) return null;
  // https://us02web.zoom.us/j/1234567890 → 1234567890
  // https://zoom.us/j/1234567890?pwd=xxx → 1234567890
  const match = url.match(/\/j\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Zoom URLでクライアントを検索
 */
async function findClientByZoomUrl(zoomUrl: string): Promise<string | null> {
  if (!zoomUrl) return null;

  const meetingId = extractMeetingIdFromUrl(zoomUrl);
  if (!meetingId) return null;

  // 全組織からクライアントを検索（zoomUrlにミーティングIDが含まれているもの）
  const clients = await prisma.client.findMany({
    where: {
      zoomUrl: { not: null },
      isActive: true,
    },
    select: {
      name: true,
      zoomUrl: true,
    },
  });

  // ミーティングIDが一致するクライアントを探す
  for (const client of clients) {
    if (client.zoomUrl) {
      const clientMeetingId = extractMeetingIdFromUrl(client.zoomUrl);
      if (clientMeetingId === meetingId) {
        logger.info('Zoom URLからクライアントを特定', { zoomUrl, clientName: client.name });
        return client.name;
      }
    }
  }

  return null;
}

export const webhookRouter = Router();

/**
 * Zoom Webhook 署名検証
 * 認証情報はDBから取得（環境変数をフォールバック）
 */
async function verifyZoomWebhook(req: Request): Promise<boolean> {
  const signature = req.headers['x-zm-signature'] as string;
  const timestamp = req.headers['x-zm-request-timestamp'] as string;

  if (!signature || !timestamp) {
    return false;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    return false;
  }

  // DBから認証情報を取得
  const zoomCreds = await getZoomCredentials();

  const message = `v0:${timestamp}:${rawBody.toString()}`;
  const hashForVerify = crypto
    .createHmac('sha256', zoomCreds.webhookSecretToken)
    .update(message)
    .digest('hex');

  const expectedSignature = `v0=${hashForVerify}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Zoom Webhook エンドポイント検証（初回セットアップ用）
 * 認証情報はDBから取得（環境変数をフォールバック）
 */
async function handleEndpointValidation(req: Request, res: Response): Promise<void> {
  const { payload } = req.body;

  if (payload?.plainToken) {
    // DBから認証情報を取得
    const zoomCreds = await getZoomCredentials();

    const hashForValidate = crypto
      .createHmac('sha256', zoomCreds.webhookSecretToken)
      .update(payload.plainToken)
      .digest('hex');

    logger.info('Webhook エンドポイント検証リクエスト');

    res.json({
      plainToken: payload.plainToken,
      encryptedToken: hashForValidate,
    });
    return;
  }

  res.status(400).json({ error: 'Invalid validation request' });
}

/**
 * 録画完了イベント処理
 */
async function handleRecordingCompleted(payload: ZoomWebhookPayload): Promise<void> {
  const { object } = payload.payload;
  const meetingId = object.uuid;
  const title = object.topic;
  const zoomUrl = object.share_url;

  webhookLogger.received('recording.completed', meetingId);

  // クライアント名を決定：Zoom URLが登録済みクライアントと一致する場合のみ割当
  const clientName = await findClientByZoomUrl(zoomUrl);

  // MP4ファイルを探す（メインの録画ファイル）
  const mp4File = object.recording_files.find(
    (file: ZoomRecordingFile) => file.file_type === 'MP4' && file.recording_type === 'shared_screen_with_speaker_view'
  ) || object.recording_files.find(
    (file: ZoomRecordingFile) => file.file_type === 'MP4'
  );

  if (!mp4File) {
    logger.warn('MP4録画ファイルが見つかりません', { meetingId, files: object.recording_files });
    return;
  }

  // ジョブキューに追加
  await addProcessingJob({
    zoomMeetingId: String(object.id),
    zoomMeetingUuid: object.uuid,
    title: object.topic,
    hostEmail: object.host_email,
    duration: object.duration,
    meetingDate: new Date(object.start_time).toISOString(),
    zoomUrl,
    downloadUrl: mp4File.download_url,
    clientName,
  });

  logger.info('処理ジョブをキューに追加しました', {
    meetingId,
    title,
    clientName: clientName || '未設定',
    zoomUrl,
    duration: object.duration,
  });
}

/**
 * Zoom Webhook メインエンドポイント
 */
webhookRouter.post('/zoom', async (req: Request, res: Response) => {
  try {
    // エンドポイント検証リクエストの処理
    if (req.body.event === 'endpoint.url_validation') {
      await handleEndpointValidation(req, res);
      return;
    }

    // 署名検証
    if (!(await verifyZoomWebhook(req))) {
      webhookLogger.rejected('署名検証失敗');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const payload = req.body as ZoomWebhookPayload;
    const { event } = payload;

    // イベントタイプに応じた処理
    switch (event) {
      case 'recording.completed':
        await handleRecordingCompleted(payload);
        break;

      case 'recording.started':
        logger.info('録画開始イベント受信', {
          meetingId: payload.payload.object.uuid,
          topic: payload.payload.object.topic,
        });
        break;

      case 'recording.stopped':
        logger.info('録画停止イベント受信', {
          meetingId: payload.payload.object.uuid,
        });
        break;

      default:
        logger.debug('未対応のWebhookイベント', { event });
    }

    // Zoomに成功レスポンスを返す
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook処理エラー', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Webhook テスト用エンドポイント（開発環境のみ）
 */
webhookRouter.post('/test', async (req: Request, res: Response) => {
  if (config.isProd) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  logger.info('テストWebhook受信', { body: req.body });

  // テスト用の録画完了イベントをシミュレート
  if (req.body.simulateRecording) {
    await addProcessingJob({
      zoomMeetingId: `test-${Date.now()}`,
      zoomMeetingUuid: `test-uuid-${Date.now()}`,
      title: req.body.title || '【テスト株式会社】テストミーティング',
      hostEmail: 'test@example.com',
      duration: 30,
      meetingDate: new Date().toISOString(),
      zoomUrl: 'https://zoom.us/test',
      downloadUrl: req.body.downloadUrl || '',
      clientName: extractClientName(req.body.title || '【テスト株式会社】テストミーティング'),
    });
  }

  res.json({ success: true, message: 'Test webhook processed' });
});

/**
 * Circleback Webhook エンドポイント
 * 組織IDはURLパスで指定: /webhook/circleback/:organizationId
 */
webhookRouter.post('/circleback/:organizationId', async (req: Request, res: Response) => {
  const { organizationId } = req.params;

  try {
    logger.info('Circleback Webhook受信', { organizationId });

    // 組織の設定を取得
    const settings = await prisma.settings.findUnique({
      where: { organizationId },
      select: {
        circlebackEnabled: true,
        circlebackWebhookSecret: true,
      },
    });

    if (!settings) {
      logger.warn('Circleback: 組織設定が見つかりません', { organizationId });
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    if (!settings.circlebackEnabled) {
      logger.warn('Circleback: 連携が無効です', { organizationId });
      res.status(403).json({ error: 'Circleback integration is disabled' });
      return;
    }

    // 署名検証
    const signature = req.headers['x-signature'] as string;
    if (!signature || !settings.circlebackWebhookSecret) {
      logger.warn('Circleback: 署名情報が不足', { organizationId, hasSignature: !!signature });
      res.status(401).json({ error: 'Missing signature or webhook secret' });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.error('Circleback: rawBodyが見つかりません');
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const isValidSignature = verifyCirclebackWebhook(
      rawBody.toString(),
      signature,
      settings.circlebackWebhookSecret
    );

    if (!isValidSignature) {
      webhookLogger.rejected('Circleback署名検証失敗');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // ペイロードを解析して保存
    const payload = req.body as CirclebackWebhookPayload;
    const meetingData = parseWebhookPayload(payload);

    const result = await saveCirclebackMeeting(organizationId, meetingData);

    if (result.success) {
      logger.info('Circlebackミーティング処理完了', {
        organizationId,
        meetingId: result.meetingId,
        name: payload.name,
      });
      res.status(200).json({ received: true, meetingId: result.meetingId });
    } else {
      logger.error('Circlebackミーティング保存失敗', {
        organizationId,
        error: result.error,
      });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Circleback Webhook処理エラー', { organizationId, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
