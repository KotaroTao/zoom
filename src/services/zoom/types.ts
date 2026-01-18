/**
 * Zoom API 型定義
 */

// ===========================================
// Webhook イベント
// ===========================================

/**
 * Zoom Webhookペイロード
 */
export interface ZoomWebhookPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: ZoomRecordingObject;
  };
}

/**
 * Webhook検証リクエスト
 */
export interface ZoomWebhookValidation {
  event: 'endpoint.url_validation';
  payload: {
    plainToken: string;
  };
}

/**
 * recording.completed イベントのオブジェクト
 */
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
  password?: string;
  recording_play_passcode?: string;
}

/**
 * 録画ファイル情報
 */
export interface ZoomRecordingFile {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: ZoomRecordingFileType;
  file_extension: string;
  file_size: number;
  play_url: string;
  download_url: string;
  status: string;
  recording_type: ZoomRecordingType;
}

/**
 * 録画ファイルタイプ
 */
export type ZoomRecordingFileType =
  | 'MP4'      // 動画
  | 'M4A'      // 音声のみ
  | 'CHAT'     // チャットログ
  | 'TRANSCRIPT' // 自動文字起こし
  | 'CSV'      // 参加者リスト
  | 'TB'       // タイムライン
  | 'CC'       // クローズドキャプション
  | 'CHAT_MESSAGE'; // チャットメッセージ

/**
 * 録画タイプ
 */
export type ZoomRecordingType =
  | 'shared_screen_with_speaker_view'
  | 'shared_screen_with_speaker_view(CC)'
  | 'shared_screen_with_gallery_view'
  | 'speaker_view'
  | 'gallery_view'
  | 'shared_screen'
  | 'audio_only'
  | 'audio_transcript'
  | 'chat_file'
  | 'active_speaker'
  | 'poll'
  | 'host_video'
  | 'closed_caption'
  | 'timeline';

// ===========================================
// API レスポンス
// ===========================================

/**
 * アクセストークンレスポンス
 */
export interface ZoomAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * 録画一覧レスポンス
 */
export interface ZoomRecordingsListResponse {
  from: string;
  to: string;
  page_count: number;
  page_size: number;
  total_records: number;
  next_page_token: string;
  meetings: ZoomRecordingMeeting[];
}

/**
 * 録画ミーティング情報
 */
export interface ZoomRecordingMeeting {
  uuid: string;
  id: number;
  account_id: string;
  host_id: string;
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

/**
 * 録画詳細レスポンス
 */
export interface ZoomRecordingDetailResponse {
  uuid: string;
  id: number;
  account_id: string;
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
  password?: string;
  download_access_token?: string;
}

// ===========================================
// 内部処理用
// ===========================================

/**
 * ダウンロード対象ファイル
 */
export interface DownloadTarget {
  fileId: string;
  fileType: ZoomRecordingFileType;
  recordingType: ZoomRecordingType;
  downloadUrl: string;
  fileSize: number;
  fileName: string;
}

/**
 * ダウンロード結果
 */
export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

/**
 * 処理対象の録画情報（パース済み）
 */
export interface ParsedRecording {
  meetingId: string;
  meetingUuid: string;
  title: string;
  clientName: string | null;
  hostEmail: string;
  startTime: Date;
  duration: number;
  shareUrl: string;
  videoFile: DownloadTarget | null;
  audioFile: DownloadTarget | null;
}
