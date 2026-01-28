/**
 * Circleback Recording紐付けロジック
 *
 * CirclebackのWebhookペイロードから、対応するRecordingを検索する
 */

import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import type { Recording } from '@prisma/client';

export interface CirclebackPayload {
  id: number;
  name: string | null;
  email: string | null;
  notes: string;
  actionItems: Array<{ text: string; assignee?: string }>;
  recordingUrl: string | null;
  tags: string[];
  icalUid: string | null;
}

/**
 * CirclebackペイロードからRecordingを検索
 *
 * 優先順位:
 * 1. hostEmail が一致 & ステータスがWAITING_CIRCLEBACK & 直近48時間
 * 2. email（参加者）が一致 & ステータスがWAITING_CIRCLEBACK & 直近48時間
 * 3. WAITING_CIRCLEBACKステータスの最新のRecording（フォールバック）
 */
export async function matchRecording(
  payload: CirclebackPayload
): Promise<Recording | null> {
  const { email } = payload;

  // 直近48時間（Circlebackの処理に時間がかかる場合を考慮）
  const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

  logger.info('Circleback: Recording検索開始', {
    email,
    cutoffDate: cutoffDate.toISOString(),
  });

  // 優先順位1: hostEmailでマッチング（WAITING_CIRCLEBACK）
  if (email) {
    const recordingByHost = await prisma.recording.findFirst({
      where: {
        hostEmail: email,
        status: 'WAITING_CIRCLEBACK',
        createdAt: { gte: cutoffDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recordingByHost) {
      logger.info('Circleback: hostEmailでマッチ', {
        recordingId: recordingByHost.id,
        title: recordingByHost.title,
      });
      return recordingByHost;
    }
  }

  // 優先順位2: WAITING_CIRCLEBACKの最新を返す（フォールバック）
  const latestWaiting = await prisma.recording.findFirst({
    where: {
      status: 'WAITING_CIRCLEBACK',
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (latestWaiting) {
    logger.info('Circleback: フォールバックでマッチ', {
      recordingId: latestWaiting.id,
      title: latestWaiting.title,
    });
    return latestWaiting;
  }

  logger.warn('Circleback: マッチするRecordingが見つかりません', { email });
  return null;
}

/**
 * RecordingをCirclebackデータで更新
 */
export async function updateWithCirclebackData(
  recordingId: string,
  data: {
    circlebackMeetingId: string;
    circlebackNotes: string;
    circlebackActionItems: Array<{ text: string; assignee?: string }>;
    circlebackRecordingUrl: string | null;
  }
): Promise<Recording> {
  logger.info('Circleback: Recording更新', {
    recordingId,
    circlebackMeetingId: data.circlebackMeetingId,
    notesLength: data.circlebackNotes.length,
    actionItemsCount: data.circlebackActionItems.length,
  });

  const updated = await prisma.recording.update({
    where: { id: recordingId },
    data: {
      circlebackMeetingId: data.circlebackMeetingId,
      circlebackNotes: data.circlebackNotes,
      circlebackActionItems: data.circlebackActionItems,
      circlebackRecordingUrl: data.circlebackRecordingUrl,
      // Circlebackノートをsummaryとしても保存（既存連携との互換性）
      summary: data.circlebackNotes,
      circlebackSyncedAt: new Date(),
    },
  });

  return updated;
}
