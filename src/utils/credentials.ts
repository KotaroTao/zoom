/**
 * DB認証情報ユーティリティ
 * ダッシュボードで設定された認証情報をDBから取得
 */

import { prisma } from './db.js';
import { config } from '../config/env.js';
import { logger } from './logger.js';

export interface DBCredentials {
  // Zoom
  zoomAccountId: string | null;
  zoomClientId: string | null;
  zoomClientSecret: string | null;
  zoomWebhookSecretToken: string | null;
  // OpenAI
  openaiApiKey: string | null;
  // Google
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleSpreadsheetId: string | null;
  // Notion
  notionApiKey: string | null;
  notionDatabaseId: string | null;
}

/**
 * DBから認証情報を取得（環境変数をフォールバック）
 * マルチテナント対応: 最初の組織の設定を取得
 */
export async function getCredentials(): Promise<DBCredentials> {
  try {
    // マルチテナント対応: organizationIdベースの設定を取得
    const settings = await prisma.settings.findFirst();

    return {
      // Zoom (DB優先、なければ環境変数)
      zoomAccountId: settings?.zoomAccountId || config.zoom.accountId || null,
      zoomClientId: settings?.zoomClientId || config.zoom.clientId || null,
      zoomClientSecret: settings?.zoomClientSecret || config.zoom.clientSecret || null,
      zoomWebhookSecretToken: settings?.zoomWebhookSecretToken || config.zoom.webhookSecretToken || null,
      // OpenAI
      openaiApiKey: settings?.openaiApiKey || config.openai.apiKey || null,
      // Google
      googleClientId: settings?.googleClientId || config.google.clientId || null,
      googleClientSecret: settings?.googleClientSecret || config.google.clientSecret || null,
      googleSpreadsheetId: settings?.googleSpreadsheetId || config.google.spreadsheetId || null,
      // Notion
      notionApiKey: settings?.notionApiKey || config.notion.apiKey || null,
      notionDatabaseId: settings?.notionDatabaseId || config.notion.databaseId || null,
    };
  } catch (error) {
    logger.warn('DB認証情報の取得に失敗、環境変数を使用', { error });

    // DBアクセス失敗時は環境変数を使用
    return {
      zoomAccountId: config.zoom.accountId || null,
      zoomClientId: config.zoom.clientId || null,
      zoomClientSecret: config.zoom.clientSecret || null,
      zoomWebhookSecretToken: config.zoom.webhookSecretToken || null,
      openaiApiKey: config.openai.apiKey || null,
      googleClientId: config.google.clientId || null,
      googleClientSecret: config.google.clientSecret || null,
      googleSpreadsheetId: config.google.spreadsheetId || null,
      notionApiKey: config.notion.apiKey || null,
      notionDatabaseId: config.notion.databaseId || null,
    };
  }
}

/**
 * スプレッドシートIDを取得
 */
export async function getSpreadsheetId(): Promise<string | null> {
  const creds = await getCredentials();
  return creds.googleSpreadsheetId;
}

/**
 * Notion認証情報を取得
 */
export async function getNotionCredentials(): Promise<{ apiKey: string | null; databaseId: string | null }> {
  const creds = await getCredentials();
  return {
    apiKey: creds.notionApiKey,
    databaseId: creds.notionDatabaseId,
  };
}

/**
 * Notion連携が有効かどうか（DB含む）
 */
export async function isNotionEnabledFromDB(): Promise<boolean> {
  const { apiKey, databaseId } = await getNotionCredentials();
  return !!(apiKey && databaseId);
}
