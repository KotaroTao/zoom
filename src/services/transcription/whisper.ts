/**
 * OpenAI Whisper 文字起こし処理
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type {
  TranscriptionResult,
  TranscriptionSegment,
  WhisperOptions,
} from './types.js';

// OpenAIクライアント
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Whisperの最大ファイルサイズ（25MB）
const MAX_FILE_SIZE = 25 * 1024 * 1024;

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
    logger.debug('ファイル情報', {
      size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      extension: path.extname(filePath),
    });

    // ファイルサイズチェック
    if (fileSize > MAX_FILE_SIZE) {
      logger.warn('ファイルサイズが大きいため、処理に時間がかかる場合があります', {
        size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${MAX_FILE_SIZE / 1024 / 1024} MB`,
      });
    }

    // Whisper API呼び出し
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
      // textフォーマット
      return {
        success: true,
        text: response,
      };
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

    logger.info('Whisper文字起こし完了', {
      textLength: verboseResponse.text.length,
      duration: `${Math.round(verboseResponse.duration / 60)}分`,
      language: verboseResponse.language,
      segmentCount: segments?.length || 0,
    });

    return {
      success: true,
      text: verboseResponse.text,
      duration: verboseResponse.duration,
      language: verboseResponse.language,
      segments,
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
