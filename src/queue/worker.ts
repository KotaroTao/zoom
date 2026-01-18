import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/env.js';
import { logger, stepLogger } from '../utils/logger.js';
import type { ProcessingJob } from '../types/index.js';

// Redis接続
const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null,
});

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
  const { recordingId, title, clientName, zoomMeetingId } = job.data;

  logger.info('='.repeat(40));
  logger.info(`録画処理開始: ${title}`);
  logger.info('='.repeat(40));

  try {
    // Step 1: Zoom録画ダウンロード
    stepLogger.start('DOWNLOAD', recordingId, { zoomMeetingId });
    await job.updateProgress(10);
    // TODO: 実際のダウンロード処理
    // const filePath = await downloadZoomRecording(job.data);
    stepLogger.complete('DOWNLOAD', recordingId);

    // Step 2: YouTubeアップロード
    stepLogger.start('UPLOAD', recordingId);
    await job.updateProgress(30);
    // TODO: 実際のアップロード処理
    // const youtubeResult = await uploadToYouTube(filePath, title, clientName);
    stepLogger.complete('UPLOAD', recordingId);

    // Step 3: 文字起こし
    stepLogger.start('TRANSCRIBE', recordingId);
    await job.updateProgress(50);
    // TODO: 実際の文字起こし処理
    // const transcript = await transcribeWithWhisper(filePath);
    stepLogger.complete('TRANSCRIBE', recordingId);

    // Step 4: 要約生成
    stepLogger.start('SUMMARIZE', recordingId);
    await job.updateProgress(70);
    // TODO: 実際の要約処理
    // const summary = await generateSummary(transcript);
    stepLogger.complete('SUMMARIZE', recordingId);

    // Step 5: Google Sheets/Notion同期
    stepLogger.start('SYNC', recordingId);
    await job.updateProgress(90);
    // TODO: 実際の同期処理
    // await syncToGoogleSheets(job.data, youtubeResult, summary);
    // await syncToNotion(job.data, youtubeResult, summary);
    stepLogger.complete('SYNC', recordingId);

    // 完了
    await job.updateProgress(100);
    logger.info('録画処理完了', { recordingId, title, clientName });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('録画処理失敗', { recordingId, title, error: errorMessage });
    throw error;
  }
}

/**
 * ワーカー起動
 */
export async function startWorker(): Promise<Worker<ProcessingJob>> {
  const worker = new Worker<ProcessingJob>(
    QUEUE_NAME,
    processRecording,
    {
      connection,
      concurrency: 1, // 同時処理数（リソース制限のため1に設定）
    }
  );

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
