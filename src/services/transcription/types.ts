/**
 * 文字起こし 型定義
 */

/**
 * 文字起こし結果
 */
export interface TranscriptionResult {
  success: boolean;
  text?: string;
  duration?: number;  // 秒
  language?: string;
  segments?: TranscriptionSegment[];
  error?: string;
}

/**
 * 文字起こしセグメント（タイムスタンプ付き）
 */
export interface TranscriptionSegment {
  id: number;
  start: number;  // 秒
  end: number;    // 秒
  text: string;
}

/**
 * Whisper APIオプション
 */
export interface WhisperOptions {
  /** 言語（自動検出の場合は省略） */
  language?: string;
  /** レスポンスフォーマット */
  responseFormat?: 'json' | 'text' | 'verbose_json' | 'srt' | 'vtt';
  /** 温度（0-1、低いほど決定的） */
  temperature?: number;
  /** プロンプト（コンテキスト提供用） */
  prompt?: string;
}

/**
 * Whisper API verbose_json レスポンス
 */
export interface WhisperVerboseResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}
