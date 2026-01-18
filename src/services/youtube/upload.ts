/**
 * YouTube 動画アップロード処理
 */

import * as fs from 'fs';
import { youtubeClient } from './client.js';
import { logger } from '../../utils/logger.js';
import type {
  UploadOptions,
  UploadResult,
  UploadProgress,
  PrivacyStatus,
} from './types.js';

/**
 * 動画の説明文を生成
 */
function generateDescription(options: UploadOptions): string {
  const lines: string[] = [];

  if (options.description) {
    lines.push(options.description);
    lines.push('');
  }

  lines.push('─'.repeat(30));

  if (options.clientName) {
    lines.push(`クライアント: ${options.clientName}`);
  }

  if (options.meetingDate) {
    const dateStr = options.meetingDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    });
    lines.push(`開催日時: ${dateStr}`);
  }

  if (options.zoomUrl) {
    lines.push(`元のZoom録画: ${options.zoomUrl}`);
  }

  lines.push('');
  lines.push('※ この動画はZoom録画から自動アップロードされました');

  return lines.join('\n');
}

/**
 * YouTube に動画をアップロード
 */
export async function uploadToYouTube(
  filePath: string,
  options: UploadOptions,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  logger.info('YouTubeアップロード開始', {
    title: options.title,
    filePath,
    privacyStatus: options.privacyStatus || 'unlisted',
  });

  try {
    // ファイル存在確認
    if (!fs.existsSync(filePath)) {
      throw new Error(`ファイルが見つかりません: ${filePath}`);
    }

    const fileSize = fs.statSync(filePath).size;
    logger.debug('アップロードファイル情報', {
      size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
    });

    // YouTube APIクライアント取得
    const youtube = await youtubeClient.getYouTube();

    // 説明文生成
    const description = generateDescription(options);

    // アップロードリクエスト
    const response = await youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: options.title,
            description,
            tags: options.tags || ['Zoom', '録画', 'ミーティング'],
            categoryId: options.categoryId || '22', // People & Blogs
          },
          status: {
            privacyStatus: options.privacyStatus || 'unlisted',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
      },
      {
        // アップロード進捗コールバック
        onUploadProgress: (evt) => {
          const progress: UploadProgress = {
            bytesUploaded: evt.bytesRead,
            totalBytes: fileSize,
            percentage: Math.round((evt.bytesRead / fileSize) * 100),
          };

          if (onProgress) {
            onProgress(progress);
          }

          // 10%刻みでログ出力
          if (progress.percentage % 10 === 0) {
            logger.debug('アップロード進捗', {
              percentage: `${progress.percentage}%`,
              uploaded: `${(progress.bytesUploaded / 1024 / 1024).toFixed(2)} MB`,
            });
          }
        },
      }
    );

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error('動画IDが取得できませんでした');
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    logger.info('YouTubeアップロード完了', {
      videoId,
      url: videoUrl,
      title: options.title,
    });

    return {
      success: true,
      videoId,
      url: videoUrl,
      title: options.title,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('YouTubeアップロード失敗', {
      title: options.title,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 動画のプライバシー設定を更新
 */
export async function updateVideoPrivacy(
  videoId: string,
  privacyStatus: PrivacyStatus
): Promise<boolean> {
  logger.info('動画プライバシー更新', { videoId, privacyStatus });

  try {
    const youtube = await youtubeClient.getYouTube();

    await youtube.videos.update({
      part: ['status'],
      requestBody: {
        id: videoId,
        status: {
          privacyStatus,
        },
      },
    });

    logger.info('動画プライバシー更新完了', { videoId, privacyStatus });
    return true;
  } catch (error) {
    logger.error('動画プライバシー更新失敗', { videoId, error });
    return false;
  }
}

/**
 * 動画情報を取得
 */
export async function getVideoInfo(videoId: string): Promise<{
  title: string;
  description: string;
  privacyStatus: string;
  url: string;
} | null> {
  try {
    const youtube = await youtubeClient.getYouTube();

    const response = await youtube.videos.list({
      part: ['snippet', 'status'],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) {
      return null;
    }

    return {
      title: video.snippet?.title || '',
      description: video.snippet?.description || '',
      privacyStatus: video.status?.privacyStatus || 'unknown',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch (error) {
    logger.error('動画情報取得失敗', { videoId, error });
    return null;
  }
}

/**
 * 動画を削除
 */
export async function deleteVideo(videoId: string): Promise<boolean> {
  logger.info('動画削除', { videoId });

  try {
    const youtube = await youtubeClient.getYouTube();

    await youtube.videos.delete({
      id: videoId,
    });

    logger.info('動画削除完了', { videoId });
    return true;
  } catch (error) {
    logger.error('動画削除失敗', { videoId, error });
    return false;
  }
}
