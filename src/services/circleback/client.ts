/**
 * Circleback Webhook 処理クライアント
 */

import crypto from 'crypto';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import type {
  CirclebackWebhookPayload,
  CirclebackMeetingData,
  CirclebackProcessResult,
} from './types.js';

/**
 * Webhook署名を検証
 * Circlebackはx-signatureヘッダーでHMAC-SHA256署名を送信
 */
export function verifyCirclebackWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // タイミング攻撃を防ぐため、timingSafeEqualを使用
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    logger.error('Circleback署名検証エラー', { error });
    return false;
  }
}

/**
 * Webhookペイロードを解析してデータ構造に変換
 */
export function parseWebhookPayload(payload: CirclebackWebhookPayload): CirclebackMeetingData {
  return {
    circlebackId: payload.id,
    name: payload.name,
    notes: payload.notes,
    transcript: payload.transcript,
    recordingUrl: payload.recordingUrl,
    duration: payload.duration,
    icalUid: payload.icalUid,
    tags: payload.tags,
    attendees: payload.attendees || [],
    circlebackCreatedAt: new Date(payload.createdAt),
    actionItems: payload.actionItems.map((item) => ({
      circlebackId: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      assigneeName: item.assignee?.name,
      assigneeEmail: item.assignee?.email,
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    })),
  };
}

/**
 * 参加者メールからクライアントを自動マッチング
 */
export async function matchClientByAttendees(
  organizationId: string,
  attendees: Array<{ name: string; email: string }>
): Promise<string | null> {
  try {
    // 組織のクライアント一覧を取得（emailDomainsが設定されているもの）
    const clients = await prisma.client.findMany({
      where: {
        organizationId,
        isActive: true,
        emailDomains: { not: null },
      },
      select: {
        id: true,
        name: true,
        emailDomains: true,
      },
    });

    if (clients.length === 0) {
      return null;
    }

    // 参加者のメールドメインを抽出
    const attendeeDomains = attendees
      .map((a) => a.email.split('@')[1]?.toLowerCase())
      .filter(Boolean);

    // 各クライアントのドメインと照合
    for (const client of clients) {
      if (!client.emailDomains) continue;

      const clientDomains = client.emailDomains
        .split(',')
        .map((d) => d.trim().toLowerCase());

      // マッチするドメインがあればそのクライアントを返す
      const matched = attendeeDomains.some((domain) =>
        clientDomains.includes(domain)
      );

      if (matched) {
        logger.info('クライアント自動マッチング成功', {
          organizationId,
          clientId: client.id,
          clientName: client.name,
        });
        return client.id;
      }
    }

    return null;
  } catch (error) {
    logger.error('クライアント自動マッチングエラー', { organizationId, error });
    return null;
  }
}

/**
 * Circlebackミーティングをデータベースに保存
 */
export async function saveCirclebackMeeting(
  organizationId: string,
  data: CirclebackMeetingData
): Promise<CirclebackProcessResult> {
  try {
    logger.info('Circlebackミーティング保存開始', {
      organizationId,
      circlebackId: data.circlebackId,
      name: data.name,
    });

    // 参加者メールからクライアントを自動マッチング
    const clientId = await matchClientByAttendees(organizationId, data.attendees);

    // upsertでミーティングを保存（既存の場合は更新）
    const meeting = await prisma.circlebackMeeting.upsert({
      where: {
        organizationId_circlebackId: {
          organizationId,
          circlebackId: data.circlebackId,
        },
      },
      create: {
        organizationId,
        clientId,
        circlebackId: data.circlebackId,
        name: data.name,
        notes: data.notes,
        transcript: data.transcript,
        recordingUrl: data.recordingUrl,
        duration: data.duration,
        icalUid: data.icalUid,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        attendees: JSON.stringify(data.attendees),
        circlebackCreatedAt: data.circlebackCreatedAt,
      },
      update: {
        name: data.name,
        notes: data.notes,
        transcript: data.transcript,
        recordingUrl: data.recordingUrl,
        duration: data.duration,
        icalUid: data.icalUid,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        attendees: JSON.stringify(data.attendees),
        // 既存のclientIdがない場合のみ更新
        ...(clientId && { clientId }),
      },
    });

    // 既存のアクションアイテムを削除してから再作成
    await prisma.circlebackActionItem.deleteMany({
      where: { meetingId: meeting.id },
    });

    // アクションアイテムを作成
    if (data.actionItems.length > 0) {
      await prisma.circlebackActionItem.createMany({
        data: data.actionItems.map((item) => ({
          meetingId: meeting.id,
          circlebackId: item.circlebackId,
          title: item.title,
          description: item.description,
          status: item.status,
          assigneeName: item.assigneeName,
          assigneeEmail: item.assigneeEmail,
          dueDate: item.dueDate,
        })),
      });
    }

    logger.info('Circlebackミーティング保存完了', {
      meetingId: meeting.id,
      clientId,
      actionItemCount: data.actionItems.length,
    });

    return {
      success: true,
      meetingId: meeting.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Circlebackミーティング保存失敗', {
      organizationId,
      circlebackId: data.circlebackId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 組織のCircleback設定を取得
 */
export async function getCirclebackSettings(organizationId: string): Promise<{
  enabled: boolean;
  webhookSecret: string | null;
} | null> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { organizationId },
      select: {
        circlebackEnabled: true,
        circlebackWebhookSecret: true,
      },
    });

    if (!settings) {
      return null;
    }

    return {
      enabled: settings.circlebackEnabled,
      webhookSecret: settings.circlebackWebhookSecret,
    };
  } catch (error) {
    logger.error('Circleback設定取得失敗', { organizationId, error });
    return null;
  }
}

/**
 * Circlebackミーティング一覧を取得
 */
export async function getCirclebackMeetings(
  organizationId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}
): Promise<{
  meetings: Array<{
    id: string;
    circlebackId: string;
    name: string;
    notes: string | null;
    duration: number | null;
    attendees: Array<{ name: string; email: string }>;
    actionItemCount: number;
    circlebackCreatedAt: Date;
    createdAt: Date;
  }>;
  total: number;
}> {
  const { limit = 20, offset = 0, search } = options;

  const where = {
    organizationId,
    ...(search && {
      OR: [
        { name: { contains: search } },
        { notes: { contains: search } },
      ],
    }),
  };

  const [meetings, total] = await Promise.all([
    prisma.circlebackMeeting.findMany({
      where,
      orderBy: { circlebackCreatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { actionItems: true },
        },
      },
    }),
    prisma.circlebackMeeting.count({ where }),
  ]);

  return {
    meetings: meetings.map((m) => ({
      id: m.id,
      circlebackId: m.circlebackId,
      name: m.name,
      notes: m.notes,
      duration: m.duration,
      attendees: m.attendees ? JSON.parse(m.attendees) : [],
      actionItemCount: m._count.actionItems,
      circlebackCreatedAt: m.circlebackCreatedAt,
      createdAt: m.createdAt,
    })),
    total,
  };
}

/**
 * Circlebackミーティングの詳細を取得
 */
export async function getCirclebackMeetingDetail(
  organizationId: string,
  meetingId: string
): Promise<{
  id: string;
  circlebackId: string;
  name: string;
  notes: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  duration: number | null;
  icalUid: string | null;
  tags: string[];
  attendees: Array<{ name: string; email: string }>;
  actionItems: Array<{
    id: string;
    circlebackId: string;
    title: string;
    description: string | null;
    status: string;
    assigneeName: string | null;
    assigneeEmail: string | null;
  }>;
  circlebackCreatedAt: Date;
  createdAt: Date;
} | null> {
  const meeting = await prisma.circlebackMeeting.findFirst({
    where: {
      id: meetingId,
      organizationId,
    },
    include: {
      actionItems: true,
    },
  });

  if (!meeting) {
    return null;
  }

  return {
    id: meeting.id,
    circlebackId: meeting.circlebackId,
    name: meeting.name,
    notes: meeting.notes,
    transcript: meeting.transcript,
    recordingUrl: meeting.recordingUrl,
    duration: meeting.duration,
    icalUid: meeting.icalUid,
    tags: meeting.tags ? JSON.parse(meeting.tags) : [],
    attendees: meeting.attendees ? JSON.parse(meeting.attendees) : [],
    actionItems: meeting.actionItems.map((item) => ({
      id: item.id,
      circlebackId: item.circlebackId,
      title: item.title,
      description: item.description,
      status: item.status,
      assigneeName: item.assigneeName,
      assigneeEmail: item.assigneeEmail,
    })),
    circlebackCreatedAt: meeting.circlebackCreatedAt,
    createdAt: meeting.createdAt,
  };
}

/**
 * アクションアイテムのステータスを更新
 */
export async function updateActionItemStatus(
  organizationId: string,
  actionItemId: string,
  status: 'PENDING' | 'COMPLETED'
): Promise<boolean> {
  try {
    // ミーティングが組織に属しているか確認
    const actionItem = await prisma.circlebackActionItem.findFirst({
      where: { id: actionItemId },
      include: {
        meeting: {
          select: { organizationId: true },
        },
      },
    });

    if (!actionItem || actionItem.meeting.organizationId !== organizationId) {
      return false;
    }

    await prisma.circlebackActionItem.update({
      where: { id: actionItemId },
      data: { status },
    });

    return true;
  } catch (error) {
    logger.error('アクションアイテム更新失敗', { actionItemId, error });
    return false;
  }
}

/**
 * 全アクションアイテム一覧を取得（フィルタリング対応）
 */
export async function getAllActionItems(
  organizationId: string,
  options: {
    status?: 'PENDING' | 'COMPLETED' | 'ALL';
    clientId?: string;
    overdue?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    assigneeName: string | null;
    assigneeEmail: string | null;
    dueDate: Date | null;
    isOverdue: boolean;
    meeting: {
      id: string;
      name: string;
      circlebackCreatedAt: Date;
    };
    client: {
      id: string;
      name: string;
    } | null;
  }>;
  total: number;
}> {
  const { status = 'ALL', clientId, overdue, limit = 50, offset = 0 } = options;
  const now = new Date();

  const where: any = {
    meeting: {
      organizationId,
      ...(clientId && { clientId }),
    },
    ...(status !== 'ALL' && { status }),
  };

  // 期限切れフィルタ
  if (overdue) {
    where.dueDate = { lt: now };
    where.status = 'PENDING';
  }

  const [items, total] = await Promise.all([
    prisma.circlebackActionItem.findMany({
      where,
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
      include: {
        meeting: {
          select: {
            id: true,
            name: true,
            circlebackCreatedAt: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.circlebackActionItem.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      assigneeName: item.assigneeName,
      assigneeEmail: item.assigneeEmail,
      dueDate: item.dueDate,
      isOverdue: item.dueDate ? item.dueDate < now && item.status === 'PENDING' : false,
      meeting: {
        id: item.meeting.id,
        name: item.meeting.name,
        circlebackCreatedAt: item.meeting.circlebackCreatedAt,
      },
      client: item.meeting.client,
    })),
    total,
  };
}

/**
 * 期限切れアクションアイテムのサマリーを取得
 */
export async function getOverdueActionItemsSummary(
  organizationId: string
): Promise<{
  total: number;
  byClient: Array<{ clientId: string | null; clientName: string; count: number }>;
}> {
  const now = new Date();

  const overdueItems = await prisma.circlebackActionItem.findMany({
    where: {
      meeting: { organizationId },
      status: 'PENDING',
      dueDate: { lt: now },
    },
    include: {
      meeting: {
        select: {
          client: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // クライアント別に集計
  const byClientMap = new Map<string, { clientId: string | null; clientName: string; count: number }>();
  for (const item of overdueItems) {
    const clientId = item.meeting.client?.id || 'none';
    const clientName = item.meeting.client?.name || '未分類';
    const existing = byClientMap.get(clientId);
    if (existing) {
      existing.count++;
    } else {
      byClientMap.set(clientId, {
        clientId: item.meeting.client?.id || null,
        clientName,
        count: 1,
      });
    }
  }

  return {
    total: overdueItems.length,
    byClient: Array.from(byClientMap.values()).sort((a, b) => b.count - a.count),
  };
}

/**
 * クライアント別レポートデータを取得
 */
export async function getClientReportData(
  organizationId: string,
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  client: { id: string; name: string } | null;
  period: { start: Date; end: Date };
  meetings: Array<{
    id: string;
    name: string;
    date: Date;
    duration: number | null;
    notesSummary: string | null;
    actionItems: Array<{
      title: string;
      status: string;
      assigneeName: string | null;
      dueDate: Date | null;
    }>;
  }>;
  actionItemsSummary: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
}> {
  const now = new Date();

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true, name: true },
  });

  const meetings = await prisma.circlebackMeeting.findMany({
    where: {
      organizationId,
      clientId,
      circlebackCreatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { circlebackCreatedAt: 'desc' },
    include: {
      actionItems: true,
    },
  });

  // アクションアイテムサマリー計算
  let total = 0, completed = 0, pending = 0, overdue = 0;
  for (const meeting of meetings) {
    for (const item of meeting.actionItems) {
      total++;
      if (item.status === 'COMPLETED') {
        completed++;
      } else {
        pending++;
        if (item.dueDate && item.dueDate < now) {
          overdue++;
        }
      }
    }
  }

  return {
    client,
    period: { start: startDate, end: endDate },
    meetings: meetings.map((m) => ({
      id: m.id,
      name: m.name,
      date: m.circlebackCreatedAt,
      duration: m.duration,
      notesSummary: m.notes ? m.notes.substring(0, 500) : null,
      actionItems: m.actionItems.map((a) => ({
        title: a.title,
        status: a.status,
        assigneeName: a.assigneeName,
        dueDate: a.dueDate,
      })),
    })),
    actionItemsSummary: { total, completed, pending, overdue },
  };
}

/**
 * 週次/月次レポート用のサマリーデータを取得
 */
export async function getPeriodicReportData(
  organizationId: string,
  period: 'weekly' | 'monthly'
): Promise<{
  period: { start: Date; end: Date; label: string };
  totalMeetings: number;
  totalDuration: number;
  byClient: Array<{
    client: { id: string; name: string } | null;
    meetingCount: number;
    totalDuration: number;
    actionItems: { total: number; completed: number; pending: number };
  }>;
  newActionItems: number;
  completedActionItems: number;
  overdueActionItems: number;
}> {
  const now = new Date();
  let startDate: Date;
  let label: string;

  if (period === 'weekly') {
    // 今週の月曜日から
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate = new Date(now);
    startDate.setDate(now.getDate() - diff);
    startDate.setHours(0, 0, 0, 0);
    label = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${now.getMonth() + 1}/${now.getDate()}`;
  } else {
    // 今月の1日から
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    label = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  }

  const meetings = await prisma.circlebackMeeting.findMany({
    where: {
      organizationId,
      circlebackCreatedAt: { gte: startDate, lte: now },
    },
    include: {
      client: { select: { id: true, name: true } },
      actionItems: true,
    },
  });

  // クライアント別集計
  const byClientMap = new Map<string, {
    client: { id: string; name: string } | null;
    meetingCount: number;
    totalDuration: number;
    actionItems: { total: number; completed: number; pending: number };
  }>();

  let totalDuration = 0;
  let newActionItems = 0;
  let completedActionItems = 0;
  let overdueActionItems = 0;

  for (const meeting of meetings) {
    const clientKey = meeting.client?.id || 'none';
    const existing = byClientMap.get(clientKey) || {
      client: meeting.client || null,
      meetingCount: 0,
      totalDuration: 0,
      actionItems: { total: 0, completed: 0, pending: 0 },
    };

    existing.meetingCount++;
    existing.totalDuration += meeting.duration || 0;
    totalDuration += meeting.duration || 0;

    for (const item of meeting.actionItems) {
      existing.actionItems.total++;
      newActionItems++;
      if (item.status === 'COMPLETED') {
        existing.actionItems.completed++;
        completedActionItems++;
      } else {
        existing.actionItems.pending++;
        if (item.dueDate && item.dueDate < now) {
          overdueActionItems++;
        }
      }
    }

    byClientMap.set(clientKey, existing);
  }

  return {
    period: { start: startDate, end: now, label },
    totalMeetings: meetings.length,
    totalDuration,
    byClient: Array.from(byClientMap.values()).sort((a, b) => b.meetingCount - a.meetingCount),
    newActionItems,
    completedActionItems,
    overdueActionItems,
  };
}
