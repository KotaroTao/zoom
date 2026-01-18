/**
 * YouTube サービス - エクスポート
 */

export { youtubeClient } from './client.js';
export {
  uploadToYouTube,
  updateVideoPrivacy,
  getVideoInfo,
  deleteVideo,
} from './upload.js';
export type {
  PrivacyStatus,
  UploadOptions,
  UploadResult,
  UploadProgress,
  YouTubeVideoResource,
  YouTubeThumbnail,
  GoogleTokens,
} from './types.js';
