/**
 * ダッシュボード用 API ルート
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { getQueueStatus } from '../../queue/worker.js';
import { zoomClient } from '../../services/zoom/client.js';
import { youtubeClient } from '../../services/youtube/client.js';
import { config } from '../../config/env.js';
import OpenAI from 'openai';

export const apiRouter = Router();

/**
 * 統計情報を取得
 */
apiRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    // 総録画数
    const totalRecordings = await prisma.recording.count();

    // クライアント数（ユニーク）
    const clientsResult = await prisma.recording.groupBy({
      by: ['clientName'],
      where: { clientName: { not: null } },
    });
    const totalClients = clientsResult.length;

    // 総録画時間（分）
    const durationResult = await prisma.recording.aggregate({
      _sum: { duration: true },
    });
    const totalDuration = durationResult._sum.duration || 0;

    // 処理完了数
    const completedCount = await prisma.recording.count({
      where: { status: 'COMPLETED' },
    });

    // 今週の録画数
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyRecordings = await prisma.recording.count({
      where: { createdAt: { gte: weekAgo } },
    });

    res.json({
      totalRecordings,
      totalClients,
      totalDuration,
      completedCount,
      weeklyRecordings,
      completionRate: totalRecordings > 0
        ? Math.round((completedCount / totalRecordings) * 100)
        : 0,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * 録画一覧を取得
 */
apiRouter.get('/recordings', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const clientName = req.query.client as string | undefined;
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (clientName) where.clientName = clientName;
    if (status) where.status = status;

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        orderBy: { meetingDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.recording.count({ where }),
    ]);

    res.json({
      recordings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Recordings API error:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

/**
 * 録画詳細を取得
 */
apiRouter.get('/recordings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.json(recording);
  } catch (error) {
    console.error('Recording detail API error:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

/**
 * クライアント一覧を取得
 */
apiRouter.get('/clients', async (_req: Request, res: Response) => {
  try {
    // 録画からユニークなクライアント名を集計
    const clientStats = await prisma.recording.groupBy({
      by: ['clientName'],
      where: { clientName: { not: null } },
      _count: { id: true },
      _sum: { duration: true },
      _max: { meetingDate: true },
    });

    const clients = clientStats.map((stat: {
      clientName: string | null;
      _count: { id: number };
      _sum: { duration: number | null };
      _max: { meetingDate: Date | null };
    }) => ({
      name: stat.clientName,
      recordingCount: stat._count.id,
      totalDuration: stat._sum.duration || 0,
      lastMeetingDate: stat._max.meetingDate,
    }));

    // 録画数で降順ソート
    clients.sort((a: { recordingCount: number }, b: { recordingCount: number }) => b.recordingCount - a.recordingCount);

    res.json({ clients });
  } catch (error) {
    console.error('Clients API error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/**
 * 特定クライアントの録画一覧
 */
apiRouter.get('/clients/:name/recordings', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);

    const recordings = await prisma.recording.findMany({
      where: { clientName: decodedName },
      orderBy: { meetingDate: 'desc' },
    });

    const stats = await prisma.recording.aggregate({
      where: { clientName: decodedName },
      _count: { id: true },
      _sum: { duration: true },
    });

    res.json({
      clientName: decodedName,
      recordings,
      stats: {
        totalRecordings: stats._count.id,
        totalDuration: stats._sum.duration || 0,
      },
    });
  } catch (error) {
    console.error('Client recordings API error:', error);
    res.status(500).json({ error: 'Failed to fetch client recordings' });
  }
});

/**
 * キューステータスを取得
 */
apiRouter.get('/queue', async (_req: Request, res: Response) => {
  try {
    const status = await getQueueStatus();
    res.json(status);
  } catch (error) {
    console.error('Queue status API error:', error);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

/**
 * 最近の処理ログ
 */
apiRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await prisma.processLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ logs });
  } catch (error) {
    console.error('Logs API error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * 文字列をマスクする（最初と最後の4文字を表示）
 */
function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

/**
 * 設定を取得（機密情報はマスク）
 */
apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    // 設定を取得（存在しない場合はデフォルト値で作成）
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'default' },
      });
    }

    // 機密情報をマスクして返す
    const maskedSettings = {
      ...settings,
      zoomAccountId: maskSecret(settings.zoomAccountId),
      zoomClientId: maskSecret(settings.zoomClientId),
      zoomClientSecret: maskSecret(settings.zoomClientSecret),
      zoomWebhookSecretToken: maskSecret(settings.zoomWebhookSecretToken),
      openaiApiKey: maskSecret(settings.openaiApiKey),
      googleClientId: maskSecret(settings.googleClientId),
      googleClientSecret: maskSecret(settings.googleClientSecret),
      // SpreadsheetIDはマスクしない（機密性が低い）
      notionApiKey: maskSecret(settings.notionApiKey),
      // notionDatabaseIdはマスクしない（機密性が低い）
    };

    res.json(maskedSettings);
  } catch (error) {
    console.error('Settings GET error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * 設定を更新
 */
apiRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const {
      youtubeEnabled,
      youtubePrivacy,
      transcriptionEnabled,
      transcriptionLanguage,
      summaryEnabled,
      summaryStyle,
      sheetsEnabled,
      notionEnabled,
    } = req.body;

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        youtubeEnabled,
        youtubePrivacy,
        transcriptionEnabled,
        transcriptionLanguage,
        summaryEnabled,
        summaryStyle,
        sheetsEnabled,
        notionEnabled,
      },
      create: {
        id: 'default',
        youtubeEnabled,
        youtubePrivacy,
        transcriptionEnabled,
        transcriptionLanguage,
        summaryEnabled,
        summaryStyle,
        sheetsEnabled,
        notionEnabled,
      },
    });

    res.json(settings);
  } catch (error) {
    console.error('Settings PUT error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * API認証情報を更新
 */
apiRouter.put('/settings/credentials', async (req: Request, res: Response) => {
  try {
    const {
      zoomAccountId,
      zoomClientId,
      zoomClientSecret,
      zoomWebhookSecretToken,
      openaiApiKey,
      googleClientId,
      googleClientSecret,
      googleSpreadsheetId,
      notionApiKey,
      notionDatabaseId,
    } = req.body;

    // 空文字列の場合はnullに変換（既存の値を消去しない）
    const updateData: Record<string, string | undefined> = {};

    if (zoomAccountId !== undefined && zoomAccountId !== '') {
      updateData.zoomAccountId = zoomAccountId;
    }
    if (zoomClientId !== undefined && zoomClientId !== '') {
      updateData.zoomClientId = zoomClientId;
    }
    if (zoomClientSecret !== undefined && zoomClientSecret !== '') {
      updateData.zoomClientSecret = zoomClientSecret;
    }
    if (zoomWebhookSecretToken !== undefined && zoomWebhookSecretToken !== '') {
      updateData.zoomWebhookSecretToken = zoomWebhookSecretToken;
    }
    if (openaiApiKey !== undefined && openaiApiKey !== '') {
      updateData.openaiApiKey = openaiApiKey;
    }
    if (googleClientId !== undefined && googleClientId !== '') {
      updateData.googleClientId = googleClientId;
    }
    if (googleClientSecret !== undefined && googleClientSecret !== '') {
      updateData.googleClientSecret = googleClientSecret;
    }
    if (googleSpreadsheetId !== undefined && googleSpreadsheetId !== '') {
      updateData.googleSpreadsheetId = googleSpreadsheetId;
    }
    if (notionApiKey !== undefined && notionApiKey !== '') {
      updateData.notionApiKey = notionApiKey;
    }
    if (notionDatabaseId !== undefined && notionDatabaseId !== '') {
      updateData.notionDatabaseId = notionDatabaseId;
    }

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        ...updateData,
      },
    });

    // マスクして返す
    res.json({
      success: true,
      message: 'API認証情報を更新しました',
      zoomAccountId: maskSecret(settings.zoomAccountId),
      zoomClientId: maskSecret(settings.zoomClientId),
      zoomClientSecret: maskSecret(settings.zoomClientSecret),
      zoomWebhookSecretToken: maskSecret(settings.zoomWebhookSecretToken),
      openaiApiKey: maskSecret(settings.openaiApiKey),
      googleClientId: maskSecret(settings.googleClientId),
      googleClientSecret: maskSecret(settings.googleClientSecret),
      googleSpreadsheetId: settings.googleSpreadsheetId,
      notionApiKey: maskSecret(settings.notionApiKey),
      notionDatabaseId: settings.notionDatabaseId,
    });
  } catch (error) {
    console.error('Credentials PUT error:', error);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

/**
 * DBから認証情報を取得するヘルパー関数
 */
async function getCredentialsFromDB() {
  const settings = await prisma.settings.findUnique({
    where: { id: 'default' },
  });
  return settings;
}

/**
 * Zoom接続テスト（DB認証情報を優先）
 */
apiRouter.post('/test/zoom', async (_req: Request, res: Response) => {
  try {
    // DBから認証情報を取得
    const dbSettings = await getCredentialsFromDB();

    // DBに認証情報があればそれを使用、なければ環境変数を使用
    const accountId = dbSettings?.zoomAccountId || config.zoom.accountId;
    const clientId = dbSettings?.zoomClientId || config.zoom.clientId;
    const clientSecret = dbSettings?.zoomClientSecret || config.zoom.clientSecret;

    if (!accountId || !clientId || !clientSecret) {
      return res.json({
        success: false,
        message: 'Zoom API認証情報が設定されていません',
      });
    }

    // Zoom OAuth トークン取得テスト
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId,
      }),
    });

    if (tokenResponse.ok) {
      res.json({
        success: true,
        message: 'Zoom API接続成功',
        accountId: accountId.substring(0, 8) + '...',
      });
    } else {
      const errorData = await tokenResponse.json() as { reason?: string };
      res.json({
        success: false,
        message: `Zoom API認証エラー: ${errorData.reason || tokenResponse.statusText}`,
      });
    }
  } catch (error) {
    console.error('Zoom test error:', error);
    res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Zoom API接続エラー',
    });
  }
});

/**
 * YouTube/Google接続テスト
 */
apiRouter.post('/test/google', async (_req: Request, res: Response) => {
  try {
    const isAuthed = await youtubeClient.checkAuth();

    if (isAuthed) {
      res.json({
        success: true,
        message: 'YouTube API接続成功',
      });
    } else {
      res.json({
        success: false,
        message: 'YouTube認証が必要です。サーバーで setup-google-auth.ts を実行してください。',
      });
    }
  } catch (error) {
    console.error('Google test error:', error);
    res.json({
      success: false,
      message: error instanceof Error ? error.message : 'YouTube API接続エラー',
    });
  }
});

/**
 * OpenAI接続テスト（DB認証情報を優先）
 */
apiRouter.post('/test/openai', async (_req: Request, res: Response) => {
  try {
    // DBから認証情報を取得
    const dbSettings = await getCredentialsFromDB();
    const apiKey = dbSettings?.openaiApiKey || config.openai.apiKey;

    if (!apiKey) {
      return res.json({
        success: false,
        message: 'OpenAI API Keyが設定されていません',
      });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // 簡単なAPIリクエストでテスト
    const response = await openai.models.list();

    if (response.data && response.data.length > 0) {
      res.json({
        success: true,
        message: 'OpenAI API接続成功',
        models: response.data.slice(0, 3).map((m) => m.id),
      });
    } else {
      res.json({
        success: false,
        message: 'OpenAI APIレスポンスが空です',
      });
    }
  } catch (error) {
    console.error('OpenAI test error:', error);
    res.json({
      success: false,
      message: error instanceof Error ? error.message : 'OpenAI API接続エラー',
    });
  }
});

/**
 * Notion接続テスト（DB認証情報を使用）
 */
apiRouter.post('/test/notion', async (_req: Request, res: Response) => {
  try {
    // DBから認証情報を取得
    const dbSettings = await getCredentialsFromDB();
    const apiKey = dbSettings?.notionApiKey;
    const databaseId = dbSettings?.notionDatabaseId;

    if (!apiKey) {
      return res.json({
        success: false,
        message: 'Notion API Keyが設定されていません',
      });
    }

    if (!databaseId) {
      return res.json({
        success: false,
        message: 'Notion Database IDが設定されていません',
      });
    }

    // Notion API でデータベース情報を取得してテスト
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json() as { title?: Array<{ plain_text: string }> };
      const dbTitle = data.title?.[0]?.plain_text || 'Unknown';
      res.json({
        success: true,
        message: `Notion接続成功: ${dbTitle}`,
      });
    } else {
      const errorData = await response.json() as { message?: string };
      res.json({
        success: false,
        message: `Notion APIエラー: ${errorData.message || response.statusText}`,
      });
    }
  } catch (error) {
    console.error('Notion test error:', error);
    res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Notion API接続エラー',
    });
  }
});

/**
 * 接続状態一括取得（DB認証情報を優先）
 */
apiRouter.get('/connection-status', async (_req: Request, res: Response) => {
  const results: Record<string, { connected: boolean; message: string; configured: boolean }> = {};
  const dbSettings = await getCredentialsFromDB();

  // Zoom
  const zoomConfigured = !!(dbSettings?.zoomAccountId || config.zoom.accountId);
  results.zoom = {
    connected: false,
    message: zoomConfigured ? '設定済み' : '未設定',
    configured: zoomConfigured,
  };

  // YouTube/Google
  const googleConfigured = !!(dbSettings?.googleClientId || config.google.clientId);
  try {
    const isAuthed = await youtubeClient.checkAuth();
    results.youtube = {
      connected: isAuthed,
      message: isAuthed ? '接続済み' : '認証が必要',
      configured: googleConfigured,
    };
  } catch {
    results.youtube = { connected: false, message: '未接続', configured: googleConfigured };
  }

  // OpenAI
  const openaiConfigured = !!(dbSettings?.openaiApiKey || config.openai.apiKey);
  results.openai = {
    connected: false,
    message: openaiConfigured ? '設定済み' : '未設定',
    configured: openaiConfigured,
  };

  // Notion
  const notionConfigured = !!(dbSettings?.notionApiKey && dbSettings?.notionDatabaseId);
  results.notion = {
    connected: false,
    message: notionConfigured ? '設定済み' : '未設定',
    configured: notionConfigured,
  };

  res.json(results);
});
