// ===========================================
// 共通型定義
// ===========================================

// -------------------------------------------
// Zoom Webhook ペイロード
// -------------------------------------------
export interface ZoomWebhookPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: ZoomRecordingObject;
  };
}

export interface ZoomRecordingObject {
  id: number;
  uuid: string;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  start_time: string;
  timezone: string;
  duration: number;
  total_size: number;
  recording_count: number;
  share_url: string;
  recording_files: ZoomRecordingFile[];
}

export interface ZoomRecordingFile {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: 'MP4' | 'M4A' | 'CHAT' | 'TRANSCRIPT' | 'CC' | 'CSV';
  file_extension: string;
  file_size: number;
  play_url: string;
  download_url: string;
  status: string;
  recording_type: string;
}

// -------------------------------------------
// 処理ジョブ
// -------------------------------------------
export interface ProcessingJob {
  recordingId: string;
  zoomMeetingId: string;
  zoomMeetingUuid?: string;
  title: string;
  hostEmail?: string;
  duration: number | null;
  meetingDate: string | Date; // ISO文字列またはDate（シリアライズ対応）
  zoomUrl: string;
  downloadUrl?: string;
  clientName: string | null;
  // 再処理用フィールド
  reprocess?: boolean;
  reprocessSteps?: string[];
}

// -------------------------------------------
// 処理ステータス
// -------------------------------------------
export type ProcessingStatus =
  | 'PENDING'
  | 'DOWNLOADING'
  | 'UPLOADING'
  | 'TRANSCRIBING'
  | 'SUMMARIZING'
  | 'SYNCING'
  | 'COMPLETED'
  | 'FAILED';

// -------------------------------------------
// 処理結果
// -------------------------------------------
export interface ProcessingResult {
  success: boolean;
  recordingId: string;
  youtubeUrl?: string;
  transcript?: string;
  summary?: string;
  error?: string;
}

// -------------------------------------------
// YouTube アップロード結果
// -------------------------------------------
export interface YouTubeUploadResult {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
}

// -------------------------------------------
// 文字起こし結果
// -------------------------------------------
export interface TranscriptionResult {
  text: string;
  duration: number;
  language: string;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

// -------------------------------------------
// 要約結果
// -------------------------------------------
export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems?: string[];
  tokensUsed: number;
}

// -------------------------------------------
// Google Sheets 行データ
// -------------------------------------------
export interface SheetRowData {
  title: string;
  clientName: string;
  meetingDate: string;
  youtubeUrl: string;
  summary: string;
  zoomUrl: string;
  duration: string;
  processedAt: string;
}

// -------------------------------------------
// Notion ページデータ
// -------------------------------------------
export interface NotionPageData {
  title: string;
  clientName: string | null;
  meetingDate: Date;
  youtubeUrl: string;
  summary: string;
  transcript: string;
  zoomUrl: string;
  duration: number;
}

// -------------------------------------------
// API レスポンス
// -------------------------------------------
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// -------------------------------------------
// ダッシュボード用
// -------------------------------------------
export interface RecordingSummary {
  id: string;
  title: string;
  clientName: string | null;
  meetingDate: Date;
  youtubeUrl: string | null;
  summary: string | null;
  status: ProcessingStatus;
  createdAt: Date;
}

export interface ClientStats {
  name: string;
  recordingCount: number;
  totalDuration: number;
  lastMeetingDate: Date;
}
