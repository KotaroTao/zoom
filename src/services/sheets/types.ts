/**
 * Google Sheets 型定義
 */

/**
 * スプレッドシートに記録する行データ
 */
export interface RecordingRow {
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
  /** 処理完了日時 */
  processedAt: Date;
}

/**
 * シートの列設定
 */
export interface SheetColumns {
  title: string;
  clientName: string;
  meetingDate: string;
  youtubeUrl: string;
  summary: string;
  zoomUrl: string;
  duration: string;
  hostEmail: string;
  processedAt: string;
}

/**
 * デフォルトの列ヘッダー
 */
export const DEFAULT_HEADERS: SheetColumns = {
  title: 'ミーティング',
  clientName: 'クライアント',
  meetingDate: '開催日時',
  youtubeUrl: 'YouTube URL',
  summary: '要約',
  zoomUrl: 'Zoom URL',
  duration: '時間（分）',
  hostEmail: 'ホスト',
  processedAt: '処理日時',
};

/**
 * 追加結果
 */
export interface AppendResult {
  success: boolean;
  rowNumber?: number;
  spreadsheetUrl?: string;
  error?: string;
}

/**
 * シート情報
 */
export interface SheetInfo {
  spreadsheetId: string;
  title: string;
  sheetId: number;
  rowCount: number;
}
