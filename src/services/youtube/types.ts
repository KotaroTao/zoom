/**
 * YouTube API 型定義
 */

/**
 * 動画のプライバシーステータス
 */
export type PrivacyStatus = 'private' | 'unlisted' | 'public';

/**
 * アップロードオプション
 */
export interface UploadOptions {
  /** 動画タイトル */
  title: string;
  /** 動画の説明 */
  description?: string;
  /** タグ */
  tags?: string[];
  /** カテゴリID（22=People & Blogs がデフォルト） */
  categoryId?: string;
  /** プライバシー設定 */
  privacyStatus?: PrivacyStatus;
  /** クライアント名（説明に追加） */
  clientName?: string;
  /** 元のZoom URL */
  zoomUrl?: string;
  /** ミーティング日時 */
  meetingDate?: Date;
}

/**
 * アップロード結果
 */
export interface UploadResult {
  success: boolean;
  videoId?: string;
  url?: string;
  title?: string;
  error?: string;
}

/**
 * アップロード進捗
 */
export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

/**
 * YouTube動画リソース（APIレスポンス）
 */
export interface YouTubeVideoResource {
  kind: 'youtube#video';
  etag: string;
  id: string;
  snippet?: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
    };
    channelTitle: string;
    tags?: string[];
    categoryId: string;
  };
  status?: {
    uploadStatus: string;
    privacyStatus: PrivacyStatus;
    license: string;
    embeddable: boolean;
    publicStatsViewable: boolean;
  };
}

/**
 * サムネイル情報
 */
export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

/**
 * 保存されたGoogle認証トークン
 */
export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}
