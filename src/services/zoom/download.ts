/**
 * Zoom録画ダウンロード処理
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { extractClientName } from '../../utils/clientParser.js';
import { zoomClient } from './client.js';
import type {
  ZoomRecordingObject,
  ZoomRecordingFile,
  DownloadTarget,
  DownloadResult,
  ParsedRecording,
} from './types.js';

/**
 * Webhookペイロードから処理対象の録画情報をパース
 */
export function parseRecordingFromWebhook(recording: ZoomRecordingObject): ParsedRecording {
  const title = recording.topic;
  const clientName = extractClientName(title);

  // 動画ファイル（MP4）を探す - 優先順位: speaker_view > shared_screen_with_speaker_view > その他
  const videoFiles = recording.recording_files.filter(
    (f) => f.file_type === 'MP4' && f.status === 'completed'
  );

  const videoFile = selectBestVideoFile(videoFiles);

  // 音声ファイル（M4A）を探す
  const audioFile = recording.recording_files.find(
    (f) => f.file_type === 'M4A' && f.status === 'completed'
  );

  return {
    meetingId: String(recording.id),
    meetingUuid: recording.uuid,
    title,
    clientName,
    hostEmail: recording.host_email,
    startTime: new Date(recording.start_time),
    duration: recording.duration,
    shareUrl: recording.share_url,
    videoFile: videoFile ? createDownloadTarget(videoFile, title) : null,
    audioFile: audioFile ? createDownloadTarget(audioFile, title) : null,
  };
}

/**
 * 最適な動画ファイルを選択
 */
function selectBestVideoFile(files: ZoomRecordingFile[]): ZoomRecordingFile | null {
  if (files.length === 0) return null;

  // 優先順位
  const priority = [
    'shared_screen_with_speaker_view',
    'speaker_view',
    'shared_screen_with_gallery_view',
    'gallery_view',
    'shared_screen',
    'active_speaker',
  ];

  for (const type of priority) {
    const file = files.find((f) => f.recording_type === type);
    if (file) return file;
  }

  // 見つからない場合は最初のファイルを返す
  return files[0];
}

/**
 * ダウンロードターゲットを作成
 */
function createDownloadTarget(file: ZoomRecordingFile, title: string): DownloadTarget {
  // ファイル名を生成（安全な文字のみ使用）
  const safeTitle = title
    .replace(/[【】\[\]「」《》]/g, '_')
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);

  const timestamp = new Date(file.recording_start).toISOString().split('T')[0];
  const extension = file.file_extension.toLowerCase();
  const fileName = `${timestamp}_${safeTitle}_${file.recording_type}.${extension}`;

  return {
    fileId: file.id,
    fileType: file.file_type,
    recordingType: file.recording_type,
    downloadUrl: file.download_url,
    fileSize: file.file_size,
    fileName,
  };
}

/**
 * 録画ファイルをダウンロード
 */
export async function downloadRecordingFile(
  target: DownloadTarget,
  outputDir?: string
): Promise<DownloadResult> {
  const tempDir = outputDir || config.app.tempDir;
  const filePath = path.join(tempDir, target.fileName);

  logger.info('録画ダウンロード開始', {
    fileName: target.fileName,
    fileSize: `${(target.fileSize / 1024 / 1024).toFixed(2)} MB`,
    recordingType: target.recordingType,
  });

  try {
    // 認証付きダウンロードURLを取得
    const authenticatedUrl = await zoomClient.getAuthenticatedDownloadUrl(
      target.downloadUrl
    );

    // ストリーミングダウンロード
    const response = await axios({
      method: 'GET',
      url: authenticatedUrl,
      responseType: 'stream',
      timeout: 600000, // 10分タイムアウト
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // ファイルに書き込み
    const writer = fs.createWriteStream(filePath);
    await pipeline(response.data, writer);

    // ファイルサイズを確認
    const stats = fs.statSync(filePath);

    logger.info('録画ダウンロード完了', {
      fileName: target.fileName,
      filePath,
      downloadedSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    });

    return {
      success: true,
      filePath,
      fileSize: stats.size,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('録画ダウンロード失敗', {
      fileName: target.fileName,
      error: errorMessage,
    });

    // 部分的にダウンロードされたファイルを削除
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 録画をダウンロード（動画または音声）
 * 動画がある場合は動画を、なければ音声をダウンロード
 */
export async function downloadRecording(
  recording: ParsedRecording
): Promise<{
  videoResult?: DownloadResult;
  audioResult?: DownloadResult;
}> {
  const results: {
    videoResult?: DownloadResult;
    audioResult?: DownloadResult;
  } = {};

  // 動画をダウンロード
  if (recording.videoFile) {
    results.videoResult = await downloadRecordingFile(recording.videoFile);
  }

  // 音声のみダウンロード（動画がない場合、または文字起こし用に必要な場合）
  if (recording.audioFile && !recording.videoFile) {
    results.audioResult = await downloadRecordingFile(recording.audioFile);
  }

  return results;
}

/**
 * 録画情報を取得してダウンロード（Meeting IDから）
 */
export async function fetchAndDownloadRecording(meetingId: string): Promise<{
  recording: ParsedRecording;
  downloadResults: {
    videoResult?: DownloadResult;
    audioResult?: DownloadResult;
  };
}> {
  logger.info('録画情報を取得中', { meetingId });

  // 録画詳細を取得
  const details = await zoomClient.getRecordingDetails(meetingId);

  // パース
  const recording = parseRecordingFromWebhook(details as unknown as ZoomRecordingObject);

  // ダウンロード
  const downloadResults = await downloadRecording(recording);

  return {
    recording,
    downloadResults,
  };
}

/**
 * ダウンロードの進捗を追跡しながらダウンロード（大容量ファイル用）
 */
export async function downloadWithProgress(
  target: DownloadTarget,
  onProgress?: (downloaded: number, total: number) => void
): Promise<DownloadResult> {
  const filePath = path.join(config.app.tempDir, target.fileName);

  logger.info('録画ダウンロード開始（進捗追跡）', {
    fileName: target.fileName,
    expectedSize: `${(target.fileSize / 1024 / 1024).toFixed(2)} MB`,
  });

  try {
    const authenticatedUrl = await zoomClient.getAuthenticatedDownloadUrl(
      target.downloadUrl
    );

    const response = await axios({
      method: 'GET',
      url: authenticatedUrl,
      responseType: 'stream',
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const totalSize = parseInt(response.headers['content-length'] || String(target.fileSize), 10);
    let downloadedSize = 0;

    const writer = fs.createWriteStream(filePath);

    response.data.on('data', (chunk: Buffer) => {
      downloadedSize += chunk.length;
      if (onProgress) {
        onProgress(downloadedSize, totalSize);
      }
    });

    await pipeline(response.data, writer);

    const stats = fs.statSync(filePath);

    logger.info('録画ダウンロード完了', {
      fileName: target.fileName,
      filePath,
      downloadedSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    });

    return {
      success: true,
      filePath,
      fileSize: stats.size,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('録画ダウンロード失敗', {
      fileName: target.fileName,
      error: errorMessage,
    });

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
