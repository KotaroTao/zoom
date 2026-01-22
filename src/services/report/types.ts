/**
 * クライアント報告書 型定義
 */

/**
 * テンプレート変数
 */
export interface TemplateVariables {
  /** 日付（YYYY年MM月DD日） */
  date: string;
  /** 時刻（HH:MM） */
  time: string;
  /** 日時（YYYY年MM月DD日 HH:MM） */
  datetime: string;
  /** クライアント名 */
  clientName: string;
  /** ミーティングタイトル */
  title: string;
  /** 概要 */
  summary: string;
  /** 議論内容（箇条書き） */
  discussions: string;
  /** 決定事項（箇条書き） */
  decisions: string;
  /** アクションアイテム（箇条書き） */
  actionItems: string;
  /** 次回に向けて（箇条書き） */
  nextSteps: string;
  /** YouTube URL */
  youtubeUrl: string;
  /** ミーティング時間（分） */
  duration: string;
}

/**
 * 報告書生成結果
 */
export interface ReportGenerationResult {
  success: boolean;
  report?: string;
  templateId?: string;
  error?: string;
}

/**
 * 報告書生成オプション
 */
export interface ReportGenerationOptions {
  /** テンプレートID（指定なしでデフォルト使用） */
  templateId?: string;
  /** カスタム変数上書き */
  customVariables?: Partial<TemplateVariables>;
}
