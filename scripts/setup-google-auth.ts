/**
 * Google OAuth 認証セットアップスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/setup-google-auth.ts
 *
 * このスクリプトは以下を行います:
 * 1. ブラウザでGoogle認証ページを開く
 * 2. ユーザーが認証を完了
 * 3. トークンを credentials/google-token.json に保存
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { URL } from 'url';
import { google } from 'googleapis';
import 'dotenv/config';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/spreadsheets',
];

const CREDENTIALS_DIR = path.join(process.cwd(), 'credentials');
const TOKEN_PATH = path.join(CREDENTIALS_DIR, 'google-token.json');

// 環境変数チェック
function checkEnvVars(): void {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ 以下の環境変数が設定されていません:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\n.env ファイルを確認してください。');
    process.exit(1);
  }
}

// credentials ディレクトリを作成
function ensureCredentialsDir(): void {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
    console.log('📁 credentials ディレクトリを作成しました');
  }
}

// OAuth2クライアントを作成
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3333/callback'
  );
}

// 認証URLを生成
function getAuthUrl(oauth2Client: ReturnType<typeof createOAuth2Client>): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // 常にリフレッシュトークンを取得
  });
}

// コールバックサーバーを起動して認証コードを受け取る
async function waitForAuthCode(
  oauth2Client: ReturnType<typeof createOAuth2Client>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '', 'http://localhost:3333');

        if (reqUrl.pathname === '/callback') {
          const code = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                  <h1>❌ 認証エラー</h1>
                  <p>エラー: ${error}</p>
                  <p>このウィンドウを閉じてください。</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`認証エラー: ${error}`));
            return;
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                  <h1>❌ エラー</h1>
                  <p>認証コードが見つかりません。</p>
                  <p>このウィンドウを閉じてください。</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error('認証コードが見つかりません'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h1>✅ 認証成功！</h1>
                <p>このウィンドウを閉じて、ターミナルに戻ってください。</p>
              </body>
            </html>
          `);

          server.close();
          resolve(code);
        }
      } catch (err) {
        reject(err);
      }
    });

    server.listen(3333, () => {
      console.log('🌐 認証コールバックサーバーを起動しました (http://localhost:3333)');
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

// トークンを取得して保存
async function getAndSaveToken(
  oauth2Client: ReturnType<typeof createOAuth2Client>,
  code: string
): Promise<void> {
  console.log('🔄 トークンを取得中...');

  const { tokens } = await oauth2Client.getToken(code);

  // トークンを保存
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  console.log(`✅ トークンを保存しました: ${TOKEN_PATH}`);

  // トークン情報を表示
  if (tokens.expiry_date) {
    const expiryDate = new Date(tokens.expiry_date);
    console.log(`   有効期限: ${expiryDate.toLocaleString('ja-JP')}`);
  }
  if (tokens.refresh_token) {
    console.log('   リフレッシュトークン: あり');
  }
}

// 既存トークンの確認
function checkExistingToken(): boolean {
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));

      if (tokenData.refresh_token) {
        console.log('ℹ️  既存のトークンが見つかりました。');
        console.log('   再認証する場合は、このまま続けてください。');
        console.log('   キャンセルする場合は Ctrl+C を押してください。\n');
        return true;
      }
    } catch {
      // パースエラーは無視
    }
  }
  return false;
}

// メイン処理
async function main(): Promise<void> {
  console.log('═'.repeat(50));
  console.log('  Google OAuth 認証セットアップ');
  console.log('═'.repeat(50));
  console.log();

  // 環境変数チェック
  checkEnvVars();
  console.log('✅ 環境変数を確認しました\n');

  // credentialsディレクトリ作成
  ensureCredentialsDir();

  // 既存トークンの確認
  checkExistingToken();

  // OAuth2クライアント作成
  const oauth2Client = createOAuth2Client();

  // 認証URL生成
  const authUrl = getAuthUrl(oauth2Client);

  console.log('📋 以下のURLをブラウザで開いて認証してください:\n');
  console.log(authUrl);
  console.log();

  // 自動でブラウザを開く（Node.js 環境）
  try {
    const open = await import('open').catch(() => null);
    if (open) {
      console.log('🌐 ブラウザを自動で開いています...\n');
      await open.default(authUrl);
    }
  } catch {
    console.log('ℹ️  ブラウザを手動で開いてください。\n');
  }

  // 認証コードを待機
  const code = await waitForAuthCode(oauth2Client);
  console.log('✅ 認証コードを受け取りました');

  // トークンを取得して保存
  await getAndSaveToken(oauth2Client, code);

  console.log();
  console.log('═'.repeat(50));
  console.log('  セットアップ完了！');
  console.log('═'.repeat(50));
  console.log();
  console.log('これで YouTube と Google Sheets の API を使用できます。');
  console.log();
}

// 実行
main().catch((error) => {
  console.error('❌ エラーが発生しました:', error.message);
  process.exit(1);
});
