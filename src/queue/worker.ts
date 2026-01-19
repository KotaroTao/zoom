/**
 * 録画処理ワーカー
 *
 * Zoom録画を順次処理:
 * 1. ダウンロード
 * 2. YouTubeアップロード
 * 3. 文字起こし
 * 4. 要約生成
 * 5. Sheets/Notion同期
 */

import * as fs from 'fs';
import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import { logger, stepLogger } from '../utils/logger.js';
import { deleteFile } from '../utils/fileManager.js';
import { prisma } from '../utils/db.js';
import type { ProcessingJob } from '../types/index.js';

// サービスのインポート
import { downloadRecordingFile } from '../services/zoom/download.js';
import { zoomClient } from '../services/zoom/client.js';
import { uploadToYouTube } from '../services/youtube/upload.js';
import { transcribeWithWhisper } from '../services/transcription/whisper.js';
import { generateSummary } from '../services/summary/openai.js';
import { appendRow } from '../services/sheets/client.js';
import { createMeetingPageWithCredentials } from '../services/notion/client.js';
import { getCredentials } from '../utils/credentials.js';

// Redis接続設定（ioredisインスタンスではなく設定オブジェクトを使用）
const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null,
};

// ジョブキュー
const QUEUE_NAME = 'recording-processing';
export const processingQueue = new Queue<ProcessingJob>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 50,
    },
  },
});

/**
 * 処理ジョブをキューに追加
 */
export async function addProcessingJob(
  data: Omit<ProcessingJob, 'recordingId'>
): Promise<Job<ProcessingJob>> {
  const recordingId = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const job = await processingQueue.add(
    'process-recording',
    {
      ...data,
      recordingId,
    },
    {
      jobId: recordingId,
    }
  );

  logger.info('ジョブ追加', { jobId: job.id, recordingId, title: data.title });

  return job;
}

/**
 * 録画処理ワーカー
 */
async function processRecording(job: Job<ProcessingJob>): Promise<void> {
  const {
    recordingId,
    title,
    clientName,
    zoomMeetingId,
    zoomUrl,
    downloadUrl,
    meetingDate,
    duration,
    hostEmail,
  } = job.data;

  logger.info('='.repeat(40));
  logger.info(`録画処理開始: ${title}`);
  logger.info('='.repeat(40));

  let downloadedFilePath: string | null = null;
  let youtubeUrl: string | null = null;
  let youtubeVideoId: string | null = null;
  let transcript: string | null = null;
  let summary: string | null = null;
  let dbRecordingId: string | null = null;

  try {
    // DBに録画レコードを作成/更新
    const dbRecording = await prisma.recording.upsert({
      where: { zoomMeetingId },
      create: {
        zoomMeetingId,
        zoomMeetingUuid: job.data.zoomMeetingUuid,
        title,
        hostEmail,
        duration,
        meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
        zoomUrl,
        clientName,
        status: 'DOWNLOADING',
      },
      update: {
        title,
        hostEmail,
        duration,
        status: 'DOWNLOADING',
      },
    });
    dbRecordingId = dbRecording.id;
    logger.info('DB録画レコード作成/更新', { dbRecordingId });
    // ==============================
    // Step 1: Zoom録画ダウンロード
    // ==============================
    stepLogger.start('DOWNLOAD', recordingId, { zoomMeetingId });
    await job.updateProgress(10);

    // Zoom APIから最新の録画情報を取得（Webhookの古いURLではなく）
    let actualDownloadUrl = downloadUrl;
    try {
      const meetingUuid = job.data.zoomMeetingUuid;
      if (meetingUuid) {
        logger.info('Zoom APIから録画情報を取得中...', { meetingUuid });
        const recordingDetails = await zoomClient.getRecordingDetails(meetingUuid);

        // MP4ファイルを探す
        const mp4File = recordingDetails.recording_files?.find(
          (f: { file_type: string; recording_type?: string }) =>
            f.file_type === 'MP4' && f.recording_type === 'shared_screen_with_speaker_view'
        ) || recordingDetails.recording_files?.find(
          (f: { file_type: string }) => f.file_type === 'MP4'
        );

        if (mp4File && mp4File.download_url) {
          actualDownloadUrl = mp4File.download_url;
          logger.info('Zoom APIからダウンロードURL取得成功');
        }
      }
    } catch (apiError) {
      logger.warn('Zoom APIからの取得失敗、Webhookのダウンロードを試行', {
        error: apiError instanceof Error ? apiError.message : String(apiError)
      });
    }

    if (actualDownloadUrl) {
      const downloadResult = await downloadRecordingFile({
        fileId: zoomMeetingId,
        fileType: 'MP4',
        recordingType: 'shared_screen_with_speaker_view',
        downloadUrl: actualDownloadUrl,
        fileSize: 0,
        fileName: `${recordingId}.mp4`,
      });

      if (!downloadResult.success || !downloadResult.filePath) {
        throw new Error(`ダウンロード失敗: ${downloadResult.error}`);
      }

      downloadedFilePath = downloadResult.filePath;
      logger.info('ダウンロード完了', { filePath: downloadedFilePath });
    } else {
      logger.warn('ダウンロードURLがありません、スキップ');
    }

    stepLogger.complete('DOWNLOAD', recordingId);

    // DBステータス更新
    if (dbRecordingId) {
      await prisma.recording.update({
        where: { id: dbRecordingId },
        data: { status: 'UPLOADING', downloadedAt: new Date() },
      });
    }

    // ==============================
    // Step 2: YouTubeアップロード
    // ==============================
    stepLogger.start('UPLOAD', recordingId);
    await job.updateProgress(30);

    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      const uploadResult = await uploadToYouTube(downloadedFilePath, {
        title,
        clientName: clientName || undefined,
        zoomUrl,
        meetingDate: meetingDate ? new Date(meetingDate) : undefined,
        privacyStatus: 'unlisted',
        tags: clientName ? [clientName, 'Zoom', '録画'] : ['Zoom', '録画'],
      });

      if (uploadResult.success && uploadResult.url) {
        youtubeUrl = uploadResult.url;
        youtubeVideoId = uploadResult.videoId || null;
        logger.info('YouTubeアップロード完了', { youtubeUrl });
      } else {
        logger.error('YouTubeアップロード失敗', { error: uploadResult.error });
      }
    } else {
      logger.warn('動画ファイルがないためYouTubeアップロードをスキップ');
    }

    stepLogger.complete('UPLOAD', recordingId);

    // DBステータス更新（YouTubeアップロード結果を保存）
    if (dbRecordingId) {
      await prisma.recording.update({
        where: { id: dbRecordingId },
        data: {
          status: 'TRANSCRIBING',
          uploadedAt: new Date(),
          youtubeUrl,
          youtubeVideoId,
          youtubeSuccess: !!youtubeUrl,
        },
      });
    }

    // ==============================
    // Step 3: 文字起こし
    // ==============================
    stepLogger.start('TRANSCRIBE', recordingId);
    await job.updateProgress(50);

    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      const transcriptionResult = await transcribeWithWhisper(downloadedFilePath, {
        language: 'ja',
      });

      if (transcriptionResult.success && transcriptionResult.text) {
        transcript = transcriptionResult.text;
        logger.info('文字起こし完了', {
          textLength: transcript.length,
          duration: transcriptionResult.duration,
        });
      } else {
        logger.error('文字起こし失敗', { error: transcriptionResult.error });
      }
    } else {
      logger.warn('動画ファイルがないため文字起こしをスキップ');
    }

    stepLogger.complete('TRANSCRIBE', recordingId);

    // DBステータス更新
    if (dbRecordingId) {
      await prisma.recording.update({
        where: { id: dbRecordingId },
        data: {
          status: 'SUMMARIZING',
          transcribedAt: new Date(),
          transcript,
        },
      });
    }

    // ==============================
    // Step 4: 要約生成
    // ==============================
    stepLogger.start('SUMMARIZE', recordingId);
    await job.updateProgress(70);

    if (transcript) {
      const summaryResult = await generateSummary(transcript, {
        clientName: clientName || undefined,
        meetingTitle: title,
        style: 'detailed',
      });

      if (summaryResult.success && summaryResult.summary) {
        summary = summaryResult.summary;
        logger.info('要約生成完了', { summaryLength: summary.length });
      } else {
        logger.error('要約生成失敗', { error: summaryResult.error });
      }
    } else {
      logger.warn('文字起こしがないため要約生成をスキップ');
    }

    stepLogger.complete('SUMMARIZE', recordingId);

    // DBステータス更新
    if (dbRecordingId) {
      await prisma.recording.update({
        where: { id: dbRecordingId },
        data: {
          status: 'SYNCING',
          summarizedAt: new Date(),
          summary,
        },
      });
    }

    // ==============================
    // Step 5: Google Sheets / Notion 同期
    // ==============================
    stepLogger.start('SYNC', recordingId);
    await job.updateProgress(90);

    // DBから認証情報を取得
    const credentials = await getCredentials();

    // 同期結果を追跡
    let sheetsSuccess: boolean | null = null;
    let sheetsError: string | null = null;
    let sheetRowNumber: number | null = null;
    let notionSuccess: boolean | null = null;
    let notionError: string | null = null;
    let notionPageId: string | null = null;

    // Google Sheets に追加
    if (credentials.googleSpreadsheetId) {
      const sheetResult = await appendRow(credentials.googleSpreadsheetId, {
        title,
        clientName,
        meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
        youtubeUrl,
        summary,
        zoomUrl,
        duration,
        hostEmail,
        processedAt: new Date(),
      });

      sheetsSuccess = sheetResult.success;
      if (sheetResult.success) {
        sheetRowNumber = sheetResult.rowNumber || null;
        logger.info('Google Sheets追加完了', { rowNumber: sheetResult.rowNumber });
      } else {
        sheetsError = sheetResult.error || 'Unknown error';
        logger.error('Google Sheets追加失敗', { error: sheetResult.error });
      }
    } else {
      logger.debug('Google Sheets連携はスキップ（スプレッドシートID未設定）');
    }

    // Notion に追加
    if (credentials.notionApiKey && credentials.notionDatabaseId) {
      const notionResult = await createMeetingPageWithCredentials(
        {
          title,
          clientName,
          meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
          youtubeUrl,
          summary,
          zoomUrl,
          duration,
          hostEmail,
          status: 'completed',
        },
        credentials.notionApiKey,
        credentials.notionDatabaseId
      );

      notionSuccess = notionResult.success;
      if (notionResult.success) {
        notionPageId = notionResult.pageId || null;
        logger.info('Notionページ作成完了', { pageUrl: notionResult.pageUrl });
      } else {
        notionError = notionResult.error || 'Unknown error';
        logger.error('Notionページ作成失敗', { error: notionResult.error });
      }
    } else {
      logger.debug('Notion連携はスキップ（認証情報未設定）');
    }

    stepLogger.complete('SYNC', recordingId);

    // ==============================
    // Step 6: クリーンアップ
    // ==============================
    await job.updateProgress(95);

    // ダウンロードした一時ファイルを削除
    if (downloadedFilePath) {
      await deleteFile(downloadedFilePath);
      logger.debug('一時ファイル削除完了', { filePath: downloadedFilePath });
    }

    // 完了
    await job.updateProgress(100);

    // DBステータスを完了に更新（同期結果を含む）
    if (dbRecordingId) {
      await prisma.recording.update({
        where: { id: dbRecordingId },
        data: {
          status: 'COMPLETED',
          syncedAt: new Date(),
          sheetRowNumber,
          sheetsSuccess,
          sheetsError,
          notionPageId,
          notionSuccess,
          notionError,
        },
      });
    }

    logger.info('='.repeat(40));
    logger.info('録画処理完了', {
      recordingId,
      title,
      clientName,
      youtubeUrl,
      hasSummary: !!summary,
    });
    logger.info('='.repeat(40));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('録画処理失敗', { recordingId, title, error: errorMessage });

    // DBステータスを失敗に更新
    if (dbRecordingId) {
      await prisma.recording.update({
        where: { id: dbRecordingId },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      }).catch(() => {});
    }

    // エラー時も一時ファイルを削除
    if (downloadedFilePath) {
      await deleteFile(downloadedFilePath).catch(() => {});
    }

    throw error;
  }
}

/**
 * ワーカー起動
 */
export async function startWorker(): Promise<Worker<ProcessingJob>> {
  const worker = new Worker<ProcessingJob>(QUEUE_NAME, processRecording, {
    connection,
    concurrency: 1, // 同時処理数（リソース制限のため1に設定）
  });

  worker.on('completed', (job) => {
    logger.info('ジョブ完了', { jobId: job.id, title: job.data.title });
  });

  worker.on('failed', (job, error) => {
    logger.error('ジョブ失敗', {
      jobId: job?.id,
      title: job?.data.title,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('progress', (job, progress) => {
    logger.debug('ジョブ進捗', { jobId: job.id, progress });
  });

  worker.on('error', (error) => {
    logger.error('ワーカーエラー', { error: error.message });
  });

  logger.info('録画処理ワーカー起動');

  return worker;
}

/**
 * キュー状態を取得
 */
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    processingQueue.getWaitingCount(),
    processingQueue.getActiveCount(),
    processingQueue.getCompletedCount(),
    processingQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
