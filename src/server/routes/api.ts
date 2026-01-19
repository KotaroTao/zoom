import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { processingQueue } from '../../queue/worker.js';
import type { ProcessingJob } from '../../types/index.js';

// 型定義
interface ClientMaster {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const router = Router();
const prisma = new PrismaClient();

/**
 * 統計情報取得
 * GET /api/stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalRecordings,
      completedRecordings,
      failedRecordings,
      clientGroups,
      totalDuration,
      thisWeekRecordings,
    ] = await Promise.all([
      prisma.recording.count(),
      prisma.recording.count({ where: { status: 'COMPLETED' } }),
      prisma.recording.count({ where: { status: 'FAILED' } }),
      prisma.recording.groupBy({
        by: ['clientName'],
        where: { clientName: { not: null } },
      }),
      prisma.recording.aggregate({ _sum: { duration: true } }),
      prisma.recording.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const totalClients = clientGroups.length;
    const completionRate = totalRecordings > 0
      ? Math.round((completedRecordings / totalRecordings) * 100)
      : 0;

    res.json({
      totalRecordings,
      completedRecordings,
      failedRecordings,
      totalClients,
      totalDurationMinutes: totalDuration._sum.duration || 0,
      thisWeekRecordings,
      completionRate,
    });
  } catch (error) {
    logger.error('統計情報取得エラー', { error });
    res.status(500).json({ error: '統計情報の取得に失敗しました' });
  }
});

/**
 * 録画一覧取得
 * GET /api/recordings
 */
router.get('/recordings', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      clientName,
      search,
      sortBy = 'meetingDate',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // フィルタ条件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status as string;
    if (clientName) where.clientName = clientName as string;
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { clientName: { contains: search as string } },
        { hostEmail: { contains: search as string } },
      ];
    }

    // ソート
    const orderBy = {
      [sortBy as string]: sortOrder as string,
    };

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          zoomMeetingId: true,
          title: true,
          clientName: true,
          hostEmail: true,
          duration: true,
          meetingDate: true,
          youtubeUrl: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.recording.count({ where }),
    ]);

    res.json({
      recordings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('録画一覧取得エラー', { error });
    res.status(500).json({ error: '録画一覧の取得に失敗しました' });
  }
});

/**
 * 録画詳細取得
 * GET /api/recordings/:id
 */
router.get('/recordings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      return res.status(404).json({ error: '録画が見つかりません' });
    }

    // 処理ログも取得
    const logs = await prisma.processLog.findMany({
      where: { recordingId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ recording, logs });
  } catch (error) {
    logger.error('録画詳細取得エラー', { error });
    res.status(500).json({ error: '録画詳細の取得に失敗しました' });
  }
});

/**
 * 録画の再処理
 * POST /api/recordings/:id/reprocess
 */
router.post('/recordings/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { steps } = req.body as { steps?: string[] };

    const recording = await prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      return res.status(404).json({ error: '録画が見つかりません' });
    }

    // ステータスをリセット
    await prisma.recording.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
      },
    });

    // キューにジョブを追加
    const jobData: ProcessingJob = {
      recordingId: id,
      zoomMeetingId: recording.zoomMeetingId,
      zoomMeetingUuid: recording.zoomMeetingUuid ?? undefined,
      title: recording.title,
      clientName: recording.clientName,
      zoomUrl: recording.zoomUrl,
      downloadUrl: recording.zoomUrl,
      meetingDate: recording.meetingDate.toISOString(),
      duration: recording.duration,
      reprocess: true,
      reprocessSteps: steps,
    };

    await processingQueue.add('process-recording', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    logger.info('録画の再処理をキューに追加', { recordingId: id });

    res.json({
      success: true,
      message: '再処理をキューに追加しました',
      recordingId: id,
    });
  } catch (error) {
    logger.error('録画再処理エラー', { error });
    res.status(500).json({ error: '再処理の開始に失敗しました' });
  }
});

/**
 * クライアント一覧取得
 * GET /api/clients
 */
router.get('/clients', async (_req: Request, res: Response) => {
  try {
    // 録画からクライアント名を集計
    const clientStats = await prisma.recording.groupBy({
      by: ['clientName'],
      _count: { id: true },
      _sum: { duration: true },
      where: { clientName: { not: null } },
      orderBy: { _count: { id: 'desc' } },
    });

    // Clientマスタから追加情報を取得
    const clientMasters = await prisma.client.findMany() as ClientMaster[];
    const clientMasterMap = new Map<string, ClientMaster>(
      clientMasters.map((c: ClientMaster) => [c.name, c])
    );

    const clients = clientStats.map((stat: {
      clientName: string | null;
      _count: { id: number };
      _sum: { duration: number | null };
    }) => {
      const master = clientMasterMap.get(stat.clientName || '');
      return {
        name: stat.clientName,
        recordingCount: stat._count.id,
        totalDuration: stat._sum.duration || 0,
        color: master?.color || null,
        description: master?.description || null,
        isActive: master?.isActive ?? true,
      };
    });

    res.json({ clients });
  } catch (error) {
    logger.error('クライアント一覧取得エラー', { error });
    res.status(500).json({ error: 'クライアント一覧の取得に失敗しました' });
  }
});

/**
 * クライアント詳細取得
 * GET /api/clients/:name
 */
router.get('/clients/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);

    // クライアントの録画を取得
    const recordings = await prisma.recording.findMany({
      where: { clientName: decodedName },
      orderBy: { meetingDate: 'desc' },
      select: {
        id: true,
        zoomMeetingId: true,
        title: true,
        duration: true,
        meetingDate: true,
        youtubeUrl: true,
        status: true,
        createdAt: true,
      },
    });

    // 統計
    type RecordingItem = { duration: number | null; status: string };
    const stats = {
      recordingCount: recordings.length,
      totalDuration: recordings.reduce((sum: number, r: RecordingItem) => sum + (r.duration || 0), 0),
      completedCount: recordings.filter((r: RecordingItem) => r.status === 'COMPLETED').length,
    };

    // マスタ情報
    const master = await prisma.client.findUnique({
      where: { name: decodedName },
    });

    res.json({
      name: decodedName,
      recordings,
      stats,
      master,
    });
  } catch (error) {
    logger.error('クライアント詳細取得エラー', { error });
    res.status(500).json({ error: 'クライアント詳細の取得に失敗しました' });
  }
});

/**
 * キュー状況取得
 * GET /api/queue
 */
router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      processingQueue.getWaiting(),
      processingQueue.getActive(),
      processingQueue.getCompleted(0, 10),
      processingQueue.getFailed(0, 10),
    ]);

    res.json({
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
      jobs: {
        waiting: waiting.map(j => ({ id: j.id, data: j.data, timestamp: j.timestamp })),
        active: active.map(j => ({ id: j.id, data: j.data, progress: j.progress, timestamp: j.timestamp })),
        recentCompleted: completed.slice(0, 5).map(j => ({ id: j.id, data: j.data, finishedOn: j.finishedOn })),
        recentFailed: failed.slice(0, 5).map(j => ({ id: j.id, data: j.data, failedReason: j.failedReason })),
      },
    });
  } catch (error) {
    logger.error('キュー状況取得エラー', { error });
    res.status(500).json({ error: 'キュー状況の取得に失敗しました' });
  }
});

export { router as apiRouter };
