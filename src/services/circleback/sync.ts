/**
 * Circleback受信後の同期処理
 *
 * Circleback Webhook受信後に呼び出され、
 * Google Sheets / Notion への同期を実行する
 */

import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { getCredentials } from '../../utils/credentials.js';
import { appendRow } from '../sheets/client.js';
import { createMeetingPageWithCredentials } from '../notion/client.js';

/**
 * Circleback受信後に同期ステップを実行
 */
export async function executeSyncStep(recordingId: string): Promise<void> {
  logger.info('Circleback: 同期処理開始', { recordingId });

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  });

  if (!recording) {
    logger.error('Circleback: Recording が見つかりません', { recordingId });
    return;
  }

  // ステータスをSYNCINGに更新
  await prisma.recording.update({
    where: { id: recordingId },
    data: { status: 'SYNCING' },
  });

  const credentials = await getCredentials();

  let sheetsSuccess: boolean | null = null;
  let sheetsError: string | null = null;
  let sheetRowNumber: number | null = null;
  let notionSuccess: boolean | null = null;
  let notionError: string | null = null;
  let notionPageId: string | null = null;

  try {
    // Google Sheets に追加
    if (credentials.googleSpreadsheetId) {
      logger.info('Circleback: Google Sheets同期開始');
      const sheetResult = await appendRow(credentials.googleSpreadsheetId, {
        title: recording.title,
        clientName: recording.clientName,
        meetingDate: recording.meetingDate,
        youtubeUrl: recording.youtubeUrl,
        summary: recording.circlebackNotes || recording.summary, // Circlebackノートを優先
        zoomUrl: recording.zoomUrl,
        duration: recording.duration,
        hostEmail: recording.hostEmail,
        processedAt: new Date(),
      });

      sheetsSuccess = sheetResult.success;
      if (sheetResult.success) {
        sheetRowNumber = sheetResult.rowNumber || null;
        logger.info('Circleback: Google Sheets同期完了', {
          rowNumber: sheetResult.rowNumber,
        });
      } else {
        sheetsError = sheetResult.error || 'Unknown error';
        logger.error('Circleback: Google Sheets同期失敗', {
          error: sheetResult.error,
        });
      }
    } else {
      logger.debug('Circleback: Google Sheets連携スキップ（未設定）');
    }

    // Notion に追加
    if (credentials.notionApiKey && credentials.notionDatabaseId) {
      logger.info('Circleback: Notion同期開始');
      const notionResult = await createMeetingPageWithCredentials(
        {
          title: recording.title,
          clientName: recording.clientName,
          meetingDate: recording.meetingDate,
          youtubeUrl: recording.youtubeUrl,
          summary: recording.circlebackNotes || recording.summary,
          zoomUrl: recording.zoomUrl,
          duration: recording.duration,
          hostEmail: recording.hostEmail,
          status: 'completed',
        },
        credentials.notionApiKey,
        credentials.notionDatabaseId
      );

      notionSuccess = notionResult.success;
      if (notionResult.success) {
        notionPageId = notionResult.pageId || null;
        logger.info('Circleback: Notion同期完了', {
          pageUrl: notionResult.pageUrl,
        });
      } else {
        notionError = notionResult.error || 'Unknown error';
        logger.error('Circleback: Notion同期失敗', {
          error: notionResult.error,
        });
      }
    } else {
      logger.debug('Circleback: Notion連携スキップ（未設定）');
    }

    // 完了ステータスに更新
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: 'COMPLETED',
        sheetRowNumber,
        sheetsSuccess,
        sheetsError,
        notionPageId,
        notionSuccess,
        notionError,
        syncedAt: new Date(),
      },
    });

    logger.info('Circleback: 同期処理完了', {
      recordingId,
      sheetsSuccess,
      notionSuccess,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Circleback: 同期処理エラー', {
      recordingId,
      error: errorMessage,
    });

    // エラーステータスに更新
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: 'FAILED',
        errorMessage: `Circleback同期エラー: ${errorMessage}`,
        sheetsSuccess,
        sheetsError,
        notionSuccess,
        notionError,
      },
    });
  }
}
