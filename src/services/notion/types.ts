/**
 * Notion API 型定義
 */

/**
 * ミーティングページのプロパティ
 */
export interface MeetingPageProperties {
  /** ミーティングタイトル */
  title: string;
  /** クライアント名 */
  clientName: string | null;
  /** 開催日時 */
  meetingDate: Date;
  /** YouTube URL */
  youtubeUrl: string | null;
  /** 要約テキスト */
  summary: string | null;
  /** 元のZoom録画URL */
  zoomUrl: string;
  /** 録画時間（分） */
  duration: number | null;
  /** ホストメール */
  hostEmail?: string;
  /** ステータス */
  status?: 'completed' | 'processing' | 'failed';
}

/**
 * ページ作成結果
 */
export interface CreatePageResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
}

/**
 * データベースのプロパティ定義
 */
export interface DatabaseProperties {
  title: 'title';
  clientName: 'select';
  meetingDate: 'date';
  youtubeUrl: 'url';
  summary: 'rich_text';
  zoomUrl: 'url';
  duration: 'number';
  hostEmail: 'email';
  status: 'status';
}

/**
 * Notionデータベースに必要なプロパティ名
 * （日本語で設定する場合の例）
 */
export const NOTION_PROPERTY_NAMES = {
  title: 'タイトル',
  clientName: 'クライアント',
  meetingDate: '開催日時',
  youtubeUrl: 'YouTube',
  summary: '要約',
  zoomUrl: 'Zoom URL',
  duration: '時間（分）',
  hostEmail: 'ホスト',
  status: 'ステータス',
} as const;

/**
 * ステータス設定
 */
export const STATUS_OPTIONS = {
  completed: { name: '完了', color: 'green' },
  processing: { name: '処理中', color: 'yellow' },
  failed: { name: '失敗', color: 'red' },
} as const;
