/**
 * OpenAI Whisper 文字起こし処理
 * 認証情報はDBから取得（環境変数をフォールバック）
 *
 * 大容量ファイル対応:
 * - 25MB以上のファイルは自動的に音声抽出・分割処理
 * - ffmpegを使用して効率的に処理
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { getOpenAICredentials } from '../credentials/index.js';
import { logger } from '../../utils/logger.js';
import {
  extractAndSplitAudio,
  cleanupAudioChunks,
  checkFfmpegAvailable,
  type AudioChunk,
} from './audioProcessor.js';
import type {
  TranscriptionResult,
  TranscriptionSegment,
  WhisperOptions,
} from './types.js';

/**
 * OpenAIクライアントを取得（DBから認証情報を取得）
 */
async function getOpenAIClient(): Promise<OpenAI> {
  const creds = await getOpenAICredentials();
  return new OpenAI({
    apiKey: creds.apiKey,
  });
}

// Whisperの最大ファイルサイズ（25MB）
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * 単一ファイルの文字起こし（内部用）
 */
async function transcribeSingleFile(
  openai: OpenAI,
  filePath: string,
  options: WhisperOptions
): Promise<{
  text: string;
  duration?: number;
  language?: string;
  segments?: TranscriptionSegment[];
}> {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
    language: options.language || 'ja',
    response_format: options.responseFormat || 'verbose_json',
    temperature: options.temperature ?? 0,
    prompt: options.prompt || 'これは日本語のミーティング録音です。',
  });

  // レスポンス形式に応じて処理
  if (typeof response === 'string') {
    return { text: response };
  }

  // verbose_jsonフォーマット
  const verboseResponse = response as unknown as {
    text: string;
    language: string;
    duration: number;
    segments?: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
    }>;
  };

  const segments: TranscriptionSegment[] | undefined = verboseResponse.segments?.map(
    (seg) => ({
      id: seg.id,
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })
  );

  return {
    text: verboseResponse.text,
    duration: verboseResponse.duration,
    language: verboseResponse.language,
    segments,
  };
}

/**
 * 複数チャンクの文字起こし結果を結合
 */
function combineChunkResults(
  chunks: AudioChunk[],
  results: Array<{
    text: string;
    duration?: number;
    language?: string;
    segments?: TranscriptionSegment[];
  }>
): {
  text: string;
  duration: number;
  language?: string;
  segments?: TranscriptionSegment[];
} {
  const allTexts: string[] = [];
  const allSegments: TranscriptionSegment[] = [];
  let totalDuration = 0;
  let language: string | undefined;

  results.forEach((result, index) => {
    const chunk = chunks[index];
    const timeOffset = chunk.startTime;

    allTexts.push(result.text);

    if (result.language && !language) {
      language = result.language;
    }

    if (result.duration) {
      totalDuration = Math.max(totalDuration, timeOffset + result.duration);
    }

    // セグメントのタイムスタンプを調整
    if (result.segments) {
      const adjustedSegments = result.segments.map((seg, segIndex) => ({
        id: allSegments.length + segIndex,
        start: seg.start + timeOffset,
        end: seg.end + timeOffset,
        text: seg.text,
      }));
      allSegments.push(...adjustedSegments);
    }
  });

  return {
    text: allTexts.join('\n\n'),
    duration: totalDuration,
    language,
    segments: allSegments.length > 0 ? allSegments : undefined,
  };
}

/**
 * 大容量ファイルの文字起こし（チャンク分割処理）
 */
async function transcribeLargeFile(
  filePath: string,
  options: WhisperOptions
): Promise<TranscriptionResult> {
  // ファイル名から録画IDを推測
  const recordingId = path.basename(filePath, path.extname(filePath));

  logger.info('大容量ファイル処理開始', { filePath, recordingId });

  // 音声抽出・分割
  const extractionResult = await extractAndSplitAudio(filePath, recordingId);

  if (!extractionResult.success || extractionResult.chunks.length === 0) {
    return {
      success: false,
      error: extractionResult.error || '音声抽出に失敗しました',
    };
  }

  const chunks = extractionResult.chunks;
  logger.info('音声チャンク準備完了', { chunkCount: chunks.length });

  try {
    // OpenAIクライアントを取得
    const openai = await getOpenAIClient();

    const results: Array<{
      text: string;
      duration?: number;
      language?: string;
      segments?: TranscriptionSegment[];
    }> = [];

    // 各チャンクを順番に文字起こし
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.info(`チャンク ${i + 1}/${chunks.length} 文字起こし中`, {
        startTime: `${Math.round(chunk.startTime / 60)}分`,
        duration: `${Math.round(chunk.duration / 60)}分`,
      });

      const result = await transcribeSingleFile(openai, chunk.filePath, options);
      results.push(result);

      logger.info(`チャンク ${i + 1}/${chunks.length} 完了`, {
        textLength: result.text.length,
      });
    }

    // 結果を結合
    const combined = combineChunkResults(chunks, results);

    logger.info('大容量ファイル文字起こし完了', {
      totalTextLength: combined.text.length,
      totalDuration: `${Math.round(combined.duration / 60)}分`,
      chunkCount: chunks.length,
    });

    return {
      success: true,
      text: combined.text,
      duration: combined.duration,
      language: combined.language,
      segments: combined.segments,
    };
  } finally {
    // 一時ファイルをクリーンアップ
    await cleanupAudioChunks(chunks);
  }
}

/**
 * 音声/動画ファイルから文字起こし
 */
export async function transcribeWithWhisper(
  filePath: string,
  options: WhisperOptions = {}
): Promise<TranscriptionResult> {
  logger.info('Whisper文字起こし開始', { filePath });

  try {
    // ファイル存在確認
    if (!fs.existsSync(filePath)) {
      throw new Error(`ファイルが見つかりません: ${filePath}`);
    }

    const fileSize = fs.statSync(filePath).size;
    const fileSizeMB = fileSize / 1024 / 1024;

    logger.debug('ファイル情報', {
      size: `${fileSizeMB.toFixed(2)} MB`,
      extension: path.extname(filePath),
    });

    // ファイルサイズが制限を超える場合は大容量処理
    if (fileSize > MAX_FILE_SIZE) {
      logger.info('ファイルサイズが25MBを超えているため、分割処理を実行します', {
        size: `${fileSizeMB.toFixed(2)} MB`,
        limit: `${MAX_FILE_SIZE / 1024 / 1024} MB`,
      });

      // ffmpegが利用可能かチェック
      const ffmpegAvailable = await checkFfmpegAvailable();
      if (!ffmpegAvailable) {
        logger.error('ffmpegが利用できません。大容量ファイルの処理をスキップします');
        return {
          success: false,
          error: `ファイルサイズ(${fileSizeMB.toFixed(1)}MB)がWhisper APIの制限(25MB)を超えています。ffmpegをインストールすると自動的に分割処理されます。`,
        };
      }

      return await transcribeLargeFile(filePath, options);
    }

    // 通常サイズのファイルは直接処理
    const openai = await getOpenAIClient();
    const result = await transcribeSingleFile(openai, filePath, options);

    logger.info('Whisper文字起こし完了', {
      textLength: result.text.length,
      duration: result.duration ? `${Math.round(result.duration / 60)}分` : undefined,
      language: result.language,
      segmentCount: result.segments?.length || 0,
    });

    return {
      success: true,
      text: result.text,
      duration: result.duration,
      language: result.language,
      segments: result.segments,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Whisper文字起こし失敗', {
      filePath,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 文字起こし結果をSRT形式に変換
 */
export function toSrtFormat(segments: TranscriptionSegment[]): string {
  return segments
    .map((seg, index) => {
      const startTime = formatSrtTime(seg.start);
      const endTime = formatSrtTime(seg.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * SRT用タイムフォーマット
 */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function pad(num: number, length: number = 2): string {
  return String(num).padStart(length, '0');
}

/**
 * 文字起こし結果をVTT形式に変換
 */
export function toVttFormat(segments: TranscriptionSegment[]): string {
  const lines = ['WEBVTT\n'];

  segments.forEach((seg) => {
    const startTime = formatVttTime(seg.start);
    const endTime = formatVttTime(seg.end);
    lines.push(`${startTime} --> ${endTime}`);
    lines.push(seg.text.trim());
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * VTT用タイムフォーマット
 */
function formatVttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * タイムスタンプ付きテキストに変換
 */
export function toTimestampedText(segments: TranscriptionSegment[]): string {
  return segments
    .map((seg) => {
      const time = formatMinuteSecond(seg.start);
      return `[${time}] ${seg.text.trim()}`;
    })
    .join('\n');
}

/**
 * 分:秒 形式のフォーマット
 */
function formatMinuteSecond(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${pad(minutes)}:${pad(secs)}`;
}
