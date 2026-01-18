/**
 * YouTube API クライアント
 */

import * as fs from 'fs';
import * as path from 'path';
import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { GoogleTokens } from './types.js';

const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'google-token.json');

/**
 * YouTube APIクライアント
 */
class YouTubeClient {
  private oauth2Client: OAuth2Client;
  private youtube: youtube_v3.Youtube | null = null;
  private initialized: boolean = false;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      'http://localhost:3333/callback'
    );

    // トークン更新イベント
    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        logger.debug('新しいリフレッシュトークンを取得');
        this.saveTokens(tokens as GoogleTokens);
      }
    });
  }

  /**
   * クライアントを初期化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 保存されたトークンを読み込み
    const tokens = this.loadTokens();
    if (!tokens) {
      throw new Error(
        'Google認証トークンが見つかりません。先に npx tsx scripts/setup-google-auth.ts を実行してください。'
      );
    }

    this.oauth2Client.setCredentials(tokens);

    // トークンの有効期限をチェック
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      logger.debug('トークンの有効期限切れ、リフレッシュ中...');
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      this.saveTokens(credentials as GoogleTokens);
    }

    // YouTube APIクライアントを作成
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });

    this.initialized = true;
    logger.debug('YouTube APIクライアント初期化完了');
  }

  /**
   * YouTube APIインスタンスを取得
   */
  async getYouTube(): Promise<youtube_v3.Youtube> {
    await this.initialize();
    if (!this.youtube) {
      throw new Error('YouTube APIクライアントが初期化されていません');
    }
    return this.youtube;
  }

  /**
   * OAuth2クライアントを取得
   */
  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * トークンを読み込み
   */
  private loadTokens(): GoogleTokens | null {
    try {
      if (!fs.existsSync(TOKEN_PATH)) {
        return null;
      }
      const tokenData = fs.readFileSync(TOKEN_PATH, 'utf-8');
      return JSON.parse(tokenData) as GoogleTokens;
    } catch (error) {
      logger.error('トークン読み込みエラー', { error });
      return null;
    }
  }

  /**
   * トークンを保存
   */
  private saveTokens(tokens: GoogleTokens): void {
    try {
      const dir = path.dirname(TOKEN_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 既存のリフレッシュトークンを保持
      const existing = this.loadTokens();
      const merged = {
        ...existing,
        ...tokens,
        refresh_token: tokens.refresh_token || existing?.refresh_token,
      };

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
      logger.debug('トークンを保存しました');
    } catch (error) {
      logger.error('トークン保存エラー', { error });
    }
  }

  /**
   * 認証状態を確認
   */
  async checkAuth(): Promise<boolean> {
    try {
      await this.initialize();
      const yt = await this.getYouTube();

      // チャンネル情報を取得してテスト
      const response = await yt.channels.list({
        part: ['snippet'],
        mine: true,
      });

      const channel = response.data.items?.[0];
      if (channel) {
        logger.info('YouTube認証OK', {
          channelId: channel.id,
          channelTitle: channel.snippet?.title,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('YouTube認証確認エラー', { error });
      return false;
    }
  }
}

// シングルトンインスタンス
export const youtubeClient = new YouTubeClient();
