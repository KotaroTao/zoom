/**
 * ダッシュボード用 API ルート
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../utils/db.js';
import { getQueueStatus } from '../../queue/worker.js';

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
