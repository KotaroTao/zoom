/**
 * 認証情報サービス
 *
 * データベースから認証情報を取得し、環境変数をフォールバックとして使用
 */

import { prisma } from '../../utils/db.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
  webhookSecretToken: string;
}

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  spreadsheetId: string;
}

interface OpenAICredentials {
  apiKey: string;
}

interface AllCredentials {
  zoom: ZoomCredentials;
  google: GoogleCredentials;
  openai: OpenAICredentials;
}

// キャッシュ
let cachedCredentials: AllCredentials | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL = 60000; // 1分

/**
 * 認証情報をDBから取得（キャッシュ付き）
 */
export async function getCredentials(): Promise<AllCredentials> {
  // キャッシュが有効な場合
  if (cachedCredentials && Date.now() < cacheExpiry) {
    return cachedCredentials;
  }

  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    cachedCredentials = {
      zoom: {
        accountId: settings?.zoomAccountId || config.zoom.accountId,
        clientId: settings?.zoomClientId || config.zoom.clientId,
        clientSecret: settings?.zoomClientSecret || config.zoom.clientSecret,
        webhookSecretToken: settings?.zoomWebhookSecretToken || config.zoom.webhookSecretToken,
      },
      google: {
        clientId: settings?.googleClientId || config.google.clientId,
        clientSecret: settings?.googleClientSecret || config.google.clientSecret,
        spreadsheetId: settings?.googleSpreadsheetId || config.google.spreadsheetId,
      },
      openai: {
        apiKey: settings?.openaiApiKey || config.openai.apiKey,
      },
    };

    cacheExpiry = Date.now() + CACHE_TTL;

    logger.debug('認証情報をDBから取得', {
      zoomConfigured: !!settings?.zoomAccountId,
      googleConfigured: !!settings?.googleClientId,
      openaiConfigured: !!settings?.openaiApiKey,
    });

    return cachedCredentials;
  } catch (error) {
    logger.warn('DB認証情報取得失敗、環境変数を使用', { error });

    // フォールバック: 環境変数
    return {
      zoom: {
        accountId: config.zoom.accountId,
        clientId: config.zoom.clientId,
        clientSecret: config.zoom.clientSecret,
        webhookSecretToken: config.zoom.webhookSecretToken,
      },
      google: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        spreadsheetId: config.google.spreadsheetId,
      },
      openai: {
        apiKey: config.openai.apiKey,
      },
    };
  }
}

/**
 * Zoom認証情報を取得
 */
export async function getZoomCredentials(): Promise<ZoomCredentials> {
  const creds = await getCredentials();
  return creds.zoom;
}

/**
 * Google認証情報を取得
 */
export async function getGoogleCredentials(): Promise<GoogleCredentials> {
  const creds = await getCredentials();
  return creds.google;
}

/**
 * OpenAI認証情報を取得
 */
export async function getOpenAICredentials(): Promise<OpenAICredentials> {
  const creds = await getCredentials();
  return creds.openai;
}

/**
 * キャッシュをクリア（設定変更時に呼び出す）
 */
export function clearCredentialsCache(): void {
  cachedCredentials = null;
  cacheExpiry = 0;
  logger.debug('認証情報キャッシュをクリア');
}
