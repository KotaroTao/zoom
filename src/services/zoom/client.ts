/**
 * Zoom API クライアント
 *
 * Server-to-Server OAuth認証を使用
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type {
  ZoomAccessTokenResponse,
  ZoomRecordingDetailResponse,
  ZoomRecordingsListResponse,
} from './types.js';

const ZOOM_API_BASE = 'https://api.zoom.us/v2';
const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token';

/**
 * Zoom APIクライアント
 */
class ZoomClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: ZOOM_API_BASE,
      timeout: 30000,
    });

    // リクエストインターセプター（トークン自動付与）
    this.axiosInstance.interceptors.request.use(async (requestConfig) => {
      const token = await this.getAccessToken();
      requestConfig.headers.Authorization = `Bearer ${token}`;
      return requestConfig;
    });

    // レスポンスインターセプター（エラーハンドリング）
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // トークン期限切れの場合、リフレッシュして再試行
          logger.warn('Zoomトークン期限切れ、再取得中...');
          this.accessToken = null;
          this.tokenExpiry = 0;

          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            const token = await this.getAccessToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.axiosInstance(originalRequest);
          }
        }
        throw error;
      }
    );
  }

  /**
   * アクセストークンを取得（キャッシュ付き）
   */
  async getAccessToken(): Promise<string> {
    // キャッシュが有効な場合はそれを返す
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    logger.debug('Zoomアクセストークンを取得中...');

    try {
      const credentials = Buffer.from(
        `${config.zoom.clientId}:${config.zoom.clientSecret}`
      ).toString('base64');

      const response = await axios.post<ZoomAccessTokenResponse>(
        ZOOM_OAUTH_URL,
        new URLSearchParams({
          grant_type: 'account_credentials',
          account_id: config.zoom.accountId,
        }),
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      logger.debug('Zoomアクセストークン取得成功', {
        expiresIn: response.data.expires_in,
      });

      return this.accessToken;
    } catch (error) {
      logger.error('Zoomアクセストークン取得失敗', { error });
      throw new Error('Zoomアクセストークンの取得に失敗しました');
    }
  }

  /**
   * 録画詳細を取得
   * @param meetingId ミーティングID or UUID
   */
  async getRecordingDetails(meetingId: string): Promise<ZoomRecordingDetailResponse> {
    // UUIDに / や // が含まれる場合はダブルエンコードが必要
    const encodedId = meetingId.includes('/')
      ? encodeURIComponent(encodeURIComponent(meetingId))
      : encodeURIComponent(meetingId);

    logger.debug('録画詳細を取得中', { meetingId });

    const response = await this.axiosInstance.get<ZoomRecordingDetailResponse>(
      `/meetings/${encodedId}/recordings`
    );

    return response.data;
  }

  /**
   * ユーザーの録画一覧を取得
   * @param userId ユーザーID（'me' または email）
   * @param from 開始日 (YYYY-MM-DD)
   * @param to 終了日 (YYYY-MM-DD)
   */
  async listRecordings(
    userId: string = 'me',
    from?: string,
    to?: string
  ): Promise<ZoomRecordingsListResponse> {
    const params: Record<string, string> = {
      page_size: '30',
    };

    if (from) params.from = from;
    if (to) params.to = to;

    logger.debug('録画一覧を取得中', { userId, from, to });

    const response = await this.axiosInstance.get<ZoomRecordingsListResponse>(
      `/users/${userId}/recordings`,
      { params }
    );

    return response.data;
  }

  /**
   * 録画ファイルのダウンロードURLを取得（認証付き）
   * @param downloadUrl 元のダウンロードURL
   */
  async getAuthenticatedDownloadUrl(downloadUrl: string): Promise<string> {
    const token = await this.getAccessToken();
    // ダウンロードURLにアクセストークンを付与
    const separator = downloadUrl.includes('?') ? '&' : '?';
    return `${downloadUrl}${separator}access_token=${token}`;
  }

  /**
   * 録画を削除
   * @param meetingId ミーティングID or UUID
   */
  async deleteRecording(meetingId: string): Promise<void> {
    const encodedId = meetingId.includes('/')
      ? encodeURIComponent(encodeURIComponent(meetingId))
      : encodeURIComponent(meetingId);

    logger.debug('録画を削除中', { meetingId });

    await this.axiosInstance.delete(`/meetings/${encodedId}/recordings`);

    logger.info('録画削除完了', { meetingId });
  }

  /**
   * 録画をゴミ箱から復元
   * @param meetingId ミーティングID or UUID
   */
  async recoverRecording(meetingId: string): Promise<void> {
    const encodedId = meetingId.includes('/')
      ? encodeURIComponent(encodeURIComponent(meetingId))
      : encodeURIComponent(meetingId);

    logger.debug('録画を復元中', { meetingId });

    await this.axiosInstance.put(
      `/meetings/${encodedId}/recordings/status`,
      { action: 'recover' }
    );

    logger.info('録画復元完了', { meetingId });
  }
}

// シングルトンインスタンス
export const zoomClient = new ZoomClient();
