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
    })),
  };
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
        })),
      });
    }

    logger.info('Circlebackミーティング保存完了', {
      meetingId: meeting.id,
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
