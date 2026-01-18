/**
 * Google Sheets API クライアント
 */

import * as fs from 'fs';
import * as path from 'path';
import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { GoogleTokens } from '../youtube/types.js';
import type { RecordingRow, AppendResult, SheetInfo, DEFAULT_HEADERS } from './types.js';

const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'google-token.json');

/**
 * Google Sheets APIクライアント
 */
class SheetsClient {
  private oauth2Client: OAuth2Client;
  private sheets: sheets_v4.Sheets | null = null;
  private initialized: boolean = false;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      'http://localhost:3333/callback'
    );
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

    // Sheets APIクライアントを作成
    this.sheets = google.sheets({
      version: 'v4',
      auth: this.oauth2Client,
    });

    this.initialized = true;
    logger.debug('Google Sheets APIクライアント初期化完了');
  }

  /**
   * Sheets APIインスタンスを取得
   */
  async getSheets(): Promise<sheets_v4.Sheets> {
    await this.initialize();
    if (!this.sheets) {
      throw new Error('Sheets APIクライアントが初期化されていません');
    }
    return this.sheets;
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
    } catch {
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
      const existing = this.loadTokens();
      const merged = {
        ...existing,
        ...tokens,
        refresh_token: tokens.refresh_token || existing?.refresh_token,
      };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
    } catch (error) {
      logger.error('トークン保存エラー', { error });
    }
  }
}

// シングルトンインスタンス
export const sheetsClient = new SheetsClient();

/**
 * 日時をスプレッドシート用にフォーマット
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

/**
 * 録画データを行配列に変換
 */
function recordingToRow(data: RecordingRow): string[] {
  return [
    data.title,
    data.clientName || '',
    formatDateTime(data.meetingDate),
    data.youtubeUrl || '',
    data.summary || '',
    data.zoomUrl,
    data.duration?.toString() || '',
    data.hostEmail || '',
    formatDateTime(data.processedAt),
  ];
}

/**
 * スプレッドシートに行を追加
 */
export async function appendRow(
  spreadsheetId: string,
  data: RecordingRow,
  sheetName: string = 'Sheet1'
): Promise<AppendResult> {
  logger.info('スプレッドシートに行を追加', {
    spreadsheetId,
    title: data.title,
    clientName: data.clientName,
  });

  try {
    const sheets = await sheetsClient.getSheets();
    const range = `${sheetName}!A:I`;
    const values = [recordingToRow(data)];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });

    // 追加された行番号を取得
    const updatedRange = response.data.updates?.updatedRange;
    const rowMatch = updatedRange?.match(/!A(\d+):/);
    const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : undefined;

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    logger.info('行追加完了', {
      rowNumber,
      spreadsheetUrl,
    });

    return {
      success: true,
      rowNumber,
      spreadsheetUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('行追加失敗', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * ヘッダー行を設定
 */
export async function setupHeaders(
  spreadsheetId: string,
  sheetName: string = 'Sheet1',
  headers: typeof DEFAULT_HEADERS = {
    title: 'ミーティング',
    clientName: 'クライアント',
    meetingDate: '開催日時',
    youtubeUrl: 'YouTube URL',
    summary: '要約',
    zoomUrl: 'Zoom URL',
    duration: '時間（分）',
    hostEmail: 'ホスト',
    processedAt: '処理日時',
  }
): Promise<boolean> {
  logger.info('ヘッダー行を設定', { spreadsheetId, sheetName });

  try {
    const sheets = await sheetsClient.getSheets();

    // 既存のデータを確認
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:I1`,
    });

    // 既にヘッダーがある場合はスキップ
    if (existing.data.values && existing.data.values.length > 0) {
      logger.debug('ヘッダー行は既に存在します');
      return true;
    }

    // ヘッダー行を追加
    const headerValues = [
      headers.title,
      headers.clientName,
      headers.meetingDate,
      headers.youtubeUrl,
      headers.summary,
      headers.zoomUrl,
      headers.duration,
      headers.hostEmail,
      headers.processedAt,
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:I1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headerValues],
      },
    });

    // ヘッダー行を太字に
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    );

    if (sheet?.properties?.sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                    },
                    backgroundColor: {
                      red: 0.9,
                      green: 0.9,
                      blue: 0.9,
                    },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
          ],
        },
      });
    }

    logger.info('ヘッダー行設定完了');
    return true;
  } catch (error) {
    logger.error('ヘッダー行設定失敗', { error });
    return false;
  }
}

/**
 * スプレッドシート情報を取得
 */
export async function getSheetInfo(spreadsheetId: string): Promise<SheetInfo | null> {
  try {
    const sheets = await sheetsClient.getSheets();

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    const sheet = response.data.sheets?.[0];
    if (!sheet?.properties) {
      return null;
    }

    return {
      spreadsheetId,
      title: response.data.properties?.title || '',
      sheetId: sheet.properties.sheetId || 0,
      rowCount: sheet.properties.gridProperties?.rowCount || 0,
    };
  } catch (error) {
    logger.error('シート情報取得失敗', { error });
    return null;
  }
}

/**
 * クライアント別にフィルタした行を取得
 */
export async function getRowsByClient(
  spreadsheetId: string,
  clientName: string,
  sheetName: string = 'Sheet1'
): Promise<string[][] | null> {
  try {
    const sheets = await sheetsClient.getSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return [];
    }

    // ヘッダー行をスキップし、クライアント名（2列目）でフィルタ
    return rows.slice(1).filter((row) => row[1] === clientName);
  } catch (error) {
    logger.error('行取得失敗', { error });
    return null;
  }
}
