/**
 * OpenAI Whisper 文字起こし処理
 * 認証情報はDBから取得（環境変数をフォールバック）
 *
 * 大容量ファイル対応:
 * - 25MB以上のファイルは自動的に音声抽出・分割処理
 * - ffmpegを使用して効率的に処理
 *
 * ハルシネーション対策:
 * - 繰り返しパターンの検出・除去
 * - プロンプトエコーバックの除去
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
    timeout: 600000, // 10分タイムアウト（大容量ファイル対応）
    maxRetries: 3,   // リトライ回数
  });
}

// Whisperの最大ファイルサイズ（25MB）
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// オーバーラップ秒数（audioProcessor.tsと同じ値）
const OVERLAP_SECONDS = 30;

/**
 * ハルシネーション（繰り返しパターン）を検出・除去
 */
function removeHallucinations(text: string): string {
  if (!text) return text;

  let result = text;

  // 1. プロンプトのエコーバックを除去
  // 「日本語のミーティング録音」が繰り返されるパターン
  const promptEchoPattern = /(?:日本語のミーティング録音[はをがで]?[^。]*[。．]?\s*)+/g;
  result = result.replace(promptEchoPattern, '');

  // 2. 同じ短いフレーズが連続して繰り返されるパターンを検出・除去
  // 例: 「はい。はい。はい。...」「うん。うん。うん。...」
  const shortPhrases = ['はい', 'うん', 'ええ', 'そう', 'ああ', 'へえ', 'ふーん', 'なるほど'];
  for (const phrase of shortPhrases) {
    // 同じフレーズが5回以上連続したら、最大3回に制限
    const repeatPattern = new RegExp(`(${phrase}[。．、]?\\s*){5,}`, 'g');
    result = result.replace(repeatPattern, `${phrase}。 ${phrase}。 ${phrase}。 `);
  }

  // 3. より汎用的な繰り返し検出（同じ文が3回以上連続）
  const sentences = result.split(/(?<=[。．！？\n])/);
  const cleanedSentences: string[] = [];
  let prevSentence = '';
  let repeatCount = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed === prevSentence) {
      repeatCount++;
      // 同じ文が3回以上連続したら、それ以上は追加しない
      if (repeatCount < 3) {
        cleanedSentences.push(sentence);
      }
    } else {
      cleanedSentences.push(sentence);
      prevSentence = trimmed;
      repeatCount = 1;
    }
  }

  result = cleanedSentences.join('');

  // 4. 末尾の大量の繰り返しを検出して除去
  // 「はい。」などが文末で大量に繰り返されているパターン
  const endRepeatPattern = /([^。．！？\n]{1,10}[。．！？]\s*)\1{10,}$/;
  const endMatch = result.match(endRepeatPattern);
  if (endMatch) {
    // 繰り返しの開始位置を見つけて、そこまでの内容を保持
    const repeatStart = result.lastIndexOf(endMatch[1].repeat(10));
    if (repeatStart > 0) {
      result = result.substring(0, repeatStart) + endMatch[1].repeat(2);
      logger.warn('末尾の繰り返しパターンを検出・除去しました', {
        pattern: endMatch[1].trim(),
        removedLength: result.length - repeatStart
      });
    }
  }

  return result.trim();
}

/**
 * テキストから最後の数文を抽出（コンテキスト用）
 * 次のチャンクの文字起こし精度向上のため
 */
function extractContextFromText(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  // 最後のmaxLength文字を取得し、文の区切りで調整
  const lastPart = text.slice(-maxLength * 2);
  const sentences = lastPart.split(/[。．！？\n]/);
  // 最後の2-3文を取得
  const contextSentences = sentences.slice(-3).filter(s => s.trim().length > 0);
  return contextSentences.join('。').slice(-maxLength);
}

/**
 * 単一ファイルの文字起こし（内部用）
 */
async function transcribeSingleFile(
  openai: OpenAI,
  filePath: string,
  options: WhisperOptions,
  contextPrompt?: string  // 前チャンクからのコンテキスト
): Promise<{
  text: string;
  duration?: number;
  language?: string;
  segments?: TranscriptionSegment[];
}> {
  // プロンプトを構築（ハルシネーション防止のため具体的な内容を指定）
  // 注意: 抽象的なプロンプトは繰り返しの原因になるため、具体的な指示を与える
  const basePrompt = options.prompt || 'ビジネスミーティングの会話を文字起こししてください。話者は複数いる可能性があります。';
  const fullPrompt = contextPrompt
    ? `${basePrompt} 直前の会話: ${contextPrompt}`
    : basePrompt;

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
    language: options.language || 'ja',
    response_format: options.responseFormat || 'verbose_json',
    temperature: options.temperature ?? 0,
    prompt: fullPrompt,
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
 * 2つのテキスト間の重複部分を検出して除去
 * オーバーラップ区間で生成された重複テキストを処理
 */
function removeDuplicateText(previousText: string, currentText: string): string {
  if (!previousText || !currentText) {
    return currentText;
  }

  // 前のテキストの最後の部分と、現在のテキストの最初の部分を比較
  const prevEnd = previousText.slice(-500);  // 最後500文字
  const currStart = currentText.slice(0, 500);  // 最初500文字

  // 最長共通部分文字列を探す（簡易版）
  let maxOverlap = 0;
  let overlapStart = 0;

  // 最小20文字以上の重複を探す
  for (let len = 20; len <= Math.min(prevEnd.length, currStart.length); len++) {
    const prevSuffix = prevEnd.slice(-len);
    const currIdx = currStart.indexOf(prevSuffix);
    if (currIdx === 0) {
      maxOverlap = len;
      overlapStart = 0;
    }
  }

  // 重複が見つかった場合、現在のテキストから重複部分を除去
  if (maxOverlap >= 20) {
    logger.debug('重複テキスト検出・除去', {
      overlapLength: maxOverlap,
      overlap: currentText.slice(0, maxOverlap).slice(0, 50) + '...'
    });
    return currentText.slice(maxOverlap).trimStart();
  }

  return currentText;
}

/**
 * 複数チャンクの文字起こし結果を結合（重複除去対応）
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
    const overlapStart = chunk.overlapStart || 0;

    // 最初のチャンク以外は重複除去
    let processedText = result.text;
    if (index > 0 && allTexts.length > 0) {
      processedText = removeDuplicateText(allTexts[allTexts.length - 1], result.text);
    }
    allTexts.push(processedText);

    if (result.language && !language) {
      language = result.language;
    }

    if (result.duration) {
      totalDuration = Math.max(totalDuration, timeOffset + result.duration);
    }

    // セグメントのタイムスタンプを調整（オーバーラップ区間のセグメントはスキップ）
    if (result.segments) {
      const filteredSegments = result.segments.filter(seg => {
        // 最初のチャンク以外では、オーバーラップ開始時間より前のセグメントはスキップ
        if (index > 0 && seg.start < overlapStart) {
          return false;
        }
        return true;
      });

      const adjustedSegments = filteredSegments.map((seg, segIndex) => ({
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

    // 各チャンクを順番に文字起こし（コンテキスト継承）
    let previousContext: string | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.info(`チャンク ${i + 1}/${chunks.length} 文字起こし中`, {
        startTime: `${Math.round(chunk.startTime / 60)}分`,
        duration: `${Math.round(chunk.duration / 60)}分`,
        hasContext: !!previousContext,
      });

      // 前のチャンクのコンテキストを渡して文字起こし
      const result = await transcribeSingleFile(openai, chunk.filePath, options, previousContext);
      results.push(result);

      // 次のチャンク用にコンテキストを抽出
      previousContext = extractContextFromText(result.text);

      logger.info(`チャンク ${i + 1}/${chunks.length} 完了`, {
        textLength: result.text.length,
      });
    }

    // 結果を結合
    const combined = combineChunkResults(chunks, results);

    // ハルシネーション除去
    const cleanedText = removeHallucinations(combined.text);
    const hallucinationRemoved = cleanedText.length < combined.text.length;

    logger.info('大容量ファイル文字起こし完了', {
      totalTextLength: cleanedText.length,
      originalLength: combined.text.length,
      hallucinationRemoved,
      totalDuration: `${Math.round(combined.duration / 60)}分`,
      chunkCount: chunks.length,
    });

    return {
      success: true,
      text: cleanedText,
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

    // ハルシネーション除去
    const cleanedText = removeHallucinations(result.text);
    const hallucinationRemoved = cleanedText.length < result.text.length;

    logger.info('Whisper文字起こし完了', {
      textLength: cleanedText.length,
      originalLength: result.text.length,
      hallucinationRemoved,
      duration: result.duration ? `${Math.round(result.duration / 60)}分` : undefined,
      language: result.language,
      segmentCount: result.segments?.length || 0,
    });

    return {
      success: true,
      text: cleanedText,
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
