/**
 * 音声処理ユーティリティ
 *
 * 大容量の動画ファイルから音声を抽出し、
 * 必要に応じて分割してWhisper APIの制限内に収める
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { logger } from '../../utils/logger.js';
import { getTempDir } from '../../utils/fileManager.js';

// Whisperの最大ファイルサイズ（25MB）
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// チャンク分割時のデフォルト長さ（秒）- 10分
const DEFAULT_CHUNK_DURATION = 600;

// 音声ビットレート（kbps）- 品質とサイズのバランス
const AUDIO_BITRATE = '64k';

export interface AudioChunk {
  filePath: string;
  startTime: number;  // 元ファイルでの開始時間（秒）
  duration: number;   // チャンクの長さ（秒）
  index: number;
}

export interface AudioExtractionResult {
  success: boolean;
  chunks: AudioChunk[];
  totalDuration?: number;
  error?: string;
}

/**
 * ffmpegが利用可能かチェック
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * ffprobeで動画の長さを取得
 */
export async function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`ffprobe実行エラー: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration)) {
          resolve(duration);
          return;
        }
      }
      reject(new Error(`動画の長さを取得できませんでした: ${errorOutput}`));
    });
  });
}

/**
 * ffmpegを実行
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);

    let errorOutput = '';

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg実行エラー: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpegエラー (code ${code}): ${errorOutput.slice(-500)}`));
      }
    });
  });
}

/**
 * 動画から音声を抽出（単一ファイル）
 */
export async function extractAudio(
  videoPath: string,
  outputPath: string,
  startTime?: number,
  duration?: number
): Promise<void> {
  const args = [
    '-y',  // 上書き許可
    '-i', videoPath,
    '-vn',  // ビデオなし
    '-acodec', 'libmp3lame',
    '-ar', '16000',  // サンプルレート16kHz（Whisper推奨）
    '-ac', '1',  // モノラル
    '-b:a', AUDIO_BITRATE,
  ];

  if (startTime !== undefined) {
    args.push('-ss', startTime.toString());
  }

  if (duration !== undefined) {
    args.push('-t', duration.toString());
  }

  args.push(outputPath);

  await runFfmpeg(args);
}

/**
 * 必要なチャンク数を計算
 */
function calculateChunkCount(
  totalDuration: number,
  estimatedBitrate: number  // bytes per second
): number {
  const estimatedTotalSize = totalDuration * estimatedBitrate;

  if (estimatedTotalSize <= MAX_FILE_SIZE) {
    return 1;
  }

  // 各チャンクが最大サイズの80%に収まるように
  const targetChunkSize = MAX_FILE_SIZE * 0.8;
  const chunkDuration = targetChunkSize / estimatedBitrate;

  return Math.ceil(totalDuration / chunkDuration);
}

/**
 * 動画ファイルから音声を抽出し、必要に応じてチャンク分割
 */
export async function extractAndSplitAudio(
  videoPath: string,
  recordingId: string
): Promise<AudioExtractionResult> {
  logger.info('音声抽出開始', { videoPath, recordingId });

  try {
    // ffmpegの確認
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('ffmpegがインストールされていません。大容量ファイルの処理にはffmpegが必要です。');
    }

    // 動画の長さを取得
    const totalDuration = await getMediaDuration(videoPath);
    logger.info('動画情報', {
      duration: `${Math.round(totalDuration / 60)}分`,
      durationSeconds: totalDuration
    });

    const tempDir = getTempDir();
    const baseFileName = `audio_${recordingId}`;

    // まず音声全体を抽出してサイズを確認
    const testAudioPath = path.join(tempDir, `${baseFileName}_test.mp3`);

    // 最初の60秒だけ抽出してビットレートを推定
    const testDuration = Math.min(60, totalDuration);
    await extractAudio(videoPath, testAudioPath, 0, testDuration);

    const testFileSize = fs.statSync(testAudioPath).size;
    const estimatedBitrate = testFileSize / testDuration;  // bytes per second

    logger.debug('音声ビットレート推定', {
      testSize: `${(testFileSize / 1024).toFixed(1)} KB`,
      estimatedBitrate: `${(estimatedBitrate / 1024).toFixed(1)} KB/s`,
      estimatedTotal: `${(estimatedBitrate * totalDuration / 1024 / 1024).toFixed(1)} MB`
    });

    // テストファイル削除
    fs.unlinkSync(testAudioPath);

    // チャンク数を決定
    const chunkCount = calculateChunkCount(totalDuration, estimatedBitrate);
    const chunkDuration = Math.ceil(totalDuration / chunkCount);

    logger.info('チャンク分割計画', {
      chunkCount,
      chunkDuration: `${Math.round(chunkDuration / 60)}分`,
      totalDuration: `${Math.round(totalDuration / 60)}分`
    });

    const chunks: AudioChunk[] = [];

    // 各チャンクを抽出
    for (let i = 0; i < chunkCount; i++) {
      const startTime = i * chunkDuration;
      const remainingDuration = totalDuration - startTime;
      const thisChunkDuration = Math.min(chunkDuration, remainingDuration);

      const chunkPath = path.join(tempDir, `${baseFileName}_chunk${i}.mp3`);

      logger.debug(`チャンク ${i + 1}/${chunkCount} 抽出中`, {
        startTime: `${Math.round(startTime / 60)}分`,
        duration: `${Math.round(thisChunkDuration / 60)}分`
      });

      await extractAudio(videoPath, chunkPath, startTime, thisChunkDuration);

      // 抽出されたファイルのサイズ確認
      const chunkSize = fs.statSync(chunkPath).size;

      if (chunkSize > MAX_FILE_SIZE) {
        logger.warn('チャンクがサイズ制限を超えています。さらに分割が必要かもしれません', {
          chunkIndex: i,
          size: `${(chunkSize / 1024 / 1024).toFixed(1)} MB`,
          limit: `${MAX_FILE_SIZE / 1024 / 1024} MB`
        });
      }

      chunks.push({
        filePath: chunkPath,
        startTime,
        duration: thisChunkDuration,
        index: i,
      });

      logger.debug(`チャンク ${i + 1}/${chunkCount} 完了`, {
        size: `${(chunkSize / 1024 / 1024).toFixed(1)} MB`
      });
    }

    logger.info('音声抽出完了', {
      chunkCount: chunks.length,
      totalDuration: `${Math.round(totalDuration / 60)}分`
    });

    return {
      success: true,
      chunks,
      totalDuration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('音声抽出失敗', { error: errorMessage });

    return {
      success: false,
      chunks: [],
      error: errorMessage,
    };
  }
}

/**
 * 一時的な音声ファイルを削除
 */
export async function cleanupAudioChunks(chunks: AudioChunk[]): Promise<void> {
  for (const chunk of chunks) {
    try {
      if (fs.existsSync(chunk.filePath)) {
        fs.unlinkSync(chunk.filePath);
        logger.debug('一時音声ファイル削除', { path: chunk.filePath });
      }
    } catch (error) {
      logger.warn('一時音声ファイル削除失敗', {
        path: chunk.filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
