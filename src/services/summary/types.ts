/**
 * 要約 型定義
 */

/**
 * 要約結果
 */
export interface SummaryResult {
  success: boolean;
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  topics?: string[];
  error?: string;
}

/**
 * 要約オプション
 */
export interface SummaryOptions {
  /** クライアント名 */
  clientName?: string;
  /** ミーティングタイトル */
  meetingTitle?: string;
  /** 最大文字数 */
  maxLength?: number;
  /** 出力言語 */
  language?: 'ja' | 'en';
  /** 追加のコンテキスト */
  context?: string;
  /** 要約スタイル */
  style?: 'brief' | 'detailed' | 'bullet';
}

/**
 * 構造化された要約
 */
export interface StructuredSummary {
  /** 概要（1-2文） */
  overview: string;
  /** 主要な議論ポイント */
  keyPoints: string[];
  /** 決定事項 */
  decisions: string[];
  /** アクションアイテム */
  actionItems: Array<{
    task: string;
    assignee?: string;
    deadline?: string;
  }>;
  /** 次回の予定/フォローアップ */
  nextSteps?: string[];
}
