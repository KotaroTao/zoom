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
import {
  generateClientReport,
  generateAndSaveClientReport,
  previewTemplate,
} from '../../services/report/index.js';

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
 * マルチテナント対応: 最初の組織の設定を取得
 */
apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    // 最初の組織の設定を取得
    const settings = await prisma.settings.findFirst();

    if (!settings) {
      res.status(404).json({ error: '設定が見つかりません。ダッシュボードで組織を作成してください。' });
      return;
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
      notionApiKey: maskSecret(settings.notionApiKey),
    };

    res.json(maskedSettings);
  } catch (error) {
    console.error('Settings GET error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * 設定を更新
 * マルチテナント対応: 最初の組織の設定を更新
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

    // 最初の設定を取得
    const existingSettings = await prisma.settings.findFirst();
    if (!existingSettings) {
      res.status(404).json({ error: '設定が見つかりません。ダッシュボードで組織を作成してください。' });
      return;
    }

    const settings = await prisma.settings.update({
      where: { id: existingSettings.id },
      data: {
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

    // 最初の設定を取得
    const existingSettings = await prisma.settings.findFirst();
    if (!existingSettings) {
      res.status(404).json({ error: '設定が見つかりません。ダッシュボードで組織を作成してください。' });
      return;
    }

    const settings = await prisma.settings.update({
      where: { id: existingSettings.id },
      data: updateData,
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
 * マルチテナント対応: 最初の組織の設定を取得
 */
async function getCredentialsFromDB() {
  // 組織ベースの設定を取得（最初の組織）
  const settings = await prisma.settings.findFirst();
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

// =============================================
// レポートテンプレート API
// =============================================

/**
 * テンプレート一覧を取得
 */
apiRouter.get('/templates', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';

    // 最初の組織のテンプレートを取得
    const org = await prisma.organization.findFirst();
    if (!org) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }

    const where: Record<string, unknown> = { organizationId: org.id };
    if (!includeInactive) {
      where.isActive = true;
    }

    const templates = await prisma.reportTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ templates });
  } catch (error) {
    console.error('Templates GET error:', error);
    res.status(500).json({ error: 'テンプレート一覧の取得に失敗しました' });
  }
});

/**
 * テンプレート詳細を取得
 */
apiRouter.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.reportTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: 'テンプレートが見つかりません' });
    }

    res.json(template);
  } catch (error) {
    console.error('Template GET error:', error);
    res.status(500).json({ error: 'テンプレートの取得に失敗しました' });
  }
});

/**
 * テンプレートを作成
 */
apiRouter.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, description, content, isDefault } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'テンプレート名と本文は必須です' });
    }

    // 最初の組織を取得
    const org = await prisma.organization.findFirst();
    if (!org) {
      return res.status(404).json({ error: '組織が見つかりません' });
    }

    // デフォルトに設定する場合、既存のデフォルトを解除
    if (isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { organizationId: org.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.reportTemplate.create({
      data: {
        organizationId: org.id,
        name,
        description: description || null,
        content,
        isDefault: isDefault || false,
        isActive: true,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Template POST error:', error);
    res.status(500).json({ error: 'テンプレートの作成に失敗しました' });
  }
});

/**
 * テンプレートを更新
 */
apiRouter.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, content, isDefault, isActive } = req.body;

    const existing = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'テンプレートが見つかりません' });
    }

    // デフォルトに設定する場合、既存のデフォルトを解除
    if (isDefault && !existing.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { organizationId: existing.organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.reportTemplate.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        content: content !== undefined ? content : existing.content,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    res.json(template);
  } catch (error) {
    console.error('Template PUT error:', error);
    res.status(500).json({ error: 'テンプレートの更新に失敗しました' });
  }
});

/**
 * テンプレートを削除
 */
apiRouter.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.reportTemplate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'テンプレートが見つかりません' });
    }

    // デフォルトテンプレートは削除不可
    if (existing.isDefault) {
      return res.status(400).json({ error: 'デフォルトテンプレートは削除できません。先に別のテンプレートをデフォルトに設定してください。' });
    }

    await prisma.reportTemplate.delete({ where: { id } });

    res.json({ success: true, message: 'テンプレートを削除しました' });
  } catch (error) {
    console.error('Template DELETE error:', error);
    res.status(500).json({ error: 'テンプレートの削除に失敗しました' });
  }
});

/**
 * テンプレートのプレビュー
 */
apiRouter.post('/templates/preview', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'テンプレート本文が必要です' });
    }

    const preview = previewTemplate(content);
    res.json({ preview });
  } catch (error) {
    console.error('Template preview error:', error);
    res.status(500).json({ error: 'プレビューの生成に失敗しました' });
  }
});

// =============================================
// クライアント報告書 API
// =============================================

/**
 * 録画の報告書を生成
 */
apiRouter.post('/recordings/:id/generate-report', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { templateId, save } = req.body;

    // save=trueの場合はDBに保存
    const result = save
      ? await generateAndSaveClientReport(id, { templateId })
      : await generateClientReport(id, { templateId });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      report: result.report,
      templateId: result.templateId,
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: '報告書の生成に失敗しました' });
  }
});

/**
 * 録画の文字起こし・要約を再処理（非同期）
 */
apiRouter.post('/recordings/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 録画を取得
    const recording = await prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      return res.status(404).json({ error: '録画が見つかりません' });
    }

    // すでに処理中の場合はエラー
    if (['DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING'].includes(recording.status)) {
      return res.status(400).json({ error: '既に処理中です' });
    }

    // ステータスを更新
    await prisma.recording.update({
      where: { id },
      data: { status: 'DOWNLOADING', errorMessage: null },
    });

    // 非同期で処理を実行（レスポンスは先に返す）
    processReprocessing(id, recording).catch((error) => {
      console.error('Background reprocess error:', error);
    });

    // 即座にレスポンスを返す
    res.json({
      success: true,
      message: '再処理を開始しました。処理には数分〜十数分かかる場合があります。',
      status: 'DOWNLOADING',
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '再処理に失敗しました',
    });
  }
});

/**
 * 再処理のバックグラウンド処理
 */
async function processReprocessing(id: string, recording: { zoomMeetingUuid: string | null; zoomMeetingId: string; clientName: string | null; title: string }) {
  let downloadedFilePath: string | null = null;

  try {
    // インポート（動的にインポート）
    const { zoomClient } = await import('../../services/zoom/client.js');
    const { downloadRecordingFile } = await import('../../services/zoom/download.js');
    const { transcribeWithWhisper } = await import('../../services/transcription/whisper.js');
    const { generateSummary, summarizeLongText } = await import('../../services/summary/openai.js');
    const { deleteFile } = await import('../../utils/fileManager.js');

    // Zoom APIから録画情報を取得してダウンロード
    let downloadUrl: string | null = null;

    if (recording.zoomMeetingUuid) {
      try {
        const recordingDetails = await zoomClient.getRecordingDetails(recording.zoomMeetingUuid);
        const mp4File = recordingDetails.recording_files?.find(
          (f: { file_type: string; recording_type?: string }) =>
            f.file_type === 'MP4' && f.recording_type === 'shared_screen_with_speaker_view'
        ) || recordingDetails.recording_files?.find(
          (f: { file_type: string }) => f.file_type === 'MP4'
        );

        if (mp4File && mp4File.download_url) {
          downloadUrl = mp4File.download_url;
        }
      } catch (apiError) {
        console.error('Zoom API error:', apiError);
      }
    }

    if (!downloadUrl) {
      await prisma.recording.update({
        where: { id },
        data: { status: 'FAILED', errorMessage: 'Zoom録画URLを取得できませんでした' },
      });
      return;
    }

    // ダウンロード
    const downloadResult = await downloadRecordingFile({
      fileId: recording.zoomMeetingId,
      fileType: 'MP4',
      recordingType: 'shared_screen_with_speaker_view',
      downloadUrl,
      fileSize: 0,
      fileName: `reprocess-${id}.mp4`,
    });

    if (!downloadResult.success || !downloadResult.filePath) {
      await prisma.recording.update({
        where: { id },
        data: { status: 'FAILED', errorMessage: `ダウンロード失敗: ${downloadResult.error}` },
      });
      return;
    }

    downloadedFilePath = downloadResult.filePath;

    // 文字起こし
    await prisma.recording.update({
      where: { id },
      data: { status: 'TRANSCRIBING' },
    });

    const transcriptionResult = await transcribeWithWhisper(downloadedFilePath, {
      language: 'ja',
    });

    if (!transcriptionResult.success || !transcriptionResult.text) {
      await prisma.recording.update({
        where: { id },
        data: { status: 'FAILED', errorMessage: `文字起こし失敗: ${transcriptionResult.error}` },
      });
      return;
    }

    const transcript = transcriptionResult.text;

    // 要約
    await prisma.recording.update({
      where: { id },
      data: { status: 'SUMMARIZING', transcript, transcribedAt: new Date() },
    });

    // 長い文字起こしの場合は分割要約を使用（40,000文字以上）
    const summaryOptions = {
      clientName: recording.clientName || undefined,
      meetingTitle: recording.title,
      style: 'detailed' as const,
    };
    const summaryResult = transcript.length > 40000
      ? await summarizeLongText(transcript, summaryOptions)
      : await generateSummary(transcript, summaryOptions);

    let summary: string | null = null;
    if (summaryResult.success && summaryResult.summary) {
      summary = summaryResult.summary;
    }

    // 完了
    await prisma.recording.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        summary,
        summarizedAt: summary ? new Date() : undefined,
        errorMessage: summary ? null : '要約の生成に失敗しました',
      },
    });

    console.log(`Reprocess completed for recording ${id}`);
  } catch (error) {
    console.error('Reprocess background error:', error);
    await prisma.recording.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : '再処理に失敗しました',
      },
    }).catch(() => {});
  } finally {
    // 一時ファイルを削除
    if (downloadedFilePath) {
      const { deleteFile } = await import('../../utils/fileManager.js');
      await deleteFile(downloadedFilePath).catch(() => {});
    }
  }
}
});

/**
 * 録画の報告書を取得
 */
apiRouter.get('/recordings/:id/report', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { id },
      select: {
        clientReport: true,
        clientReportTemplateId: true,
        clientReportGeneratedAt: true,
      },
    });

    if (!recording) {
      return res.status(404).json({ error: '録画が見つかりません' });
    }

    if (!recording.clientReport) {
      return res.status(404).json({ error: '報告書がまだ生成されていません' });
    }

    res.json({
      report: recording.clientReport,
      templateId: recording.clientReportTemplateId,
      generatedAt: recording.clientReportGeneratedAt,
    });
  } catch (error) {
    console.error('Report GET error:', error);
    res.status(500).json({ error: '報告書の取得に失敗しました' });
  }
});
