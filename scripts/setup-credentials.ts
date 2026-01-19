/**
 * 認証情報セットアップスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/setup-credentials.ts
 *
 * 対話式で認証情報をDBに保存します。
 */

import * as path from 'path';
import * as readline from 'readline';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.cwd(), 'prisma', 'data.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  console.log('═'.repeat(50));
  console.log('  Zoom YouTube Automation - 認証情報セットアップ');
  console.log('═'.repeat(50));
  console.log();

  const db = new Database(DB_PATH);

  // 現在の設定を取得
  const current = db.prepare('SELECT * FROM Settings WHERE id = ?').get('default') as Record<string, unknown> | undefined;

  console.log('現在の設定をそのまま使用する場合は空欄でEnterを押してください。');
  console.log();

  // Zoom設定
  console.log('--- Zoom API 設定 ---');
  const zoomAccountId = await question(`Zoom Account ID [${current?.zoomAccountId || '未設定'}]: `) || current?.zoomAccountId as string || null;
  const zoomClientId = await question(`Zoom Client ID [${current?.zoomClientId || '未設定'}]: `) || current?.zoomClientId as string || null;
  const zoomClientSecret = await question(`Zoom Client Secret [${current?.zoomClientSecret ? '***' : '未設定'}]: `) || current?.zoomClientSecret as string || null;
  const zoomWebhookSecretToken = await question(`Zoom Webhook Secret Token [${current?.zoomWebhookSecretToken ? '***' : '未設定'}]: `) || current?.zoomWebhookSecretToken as string || null;

  console.log();
  console.log('--- OpenAI API 設定 ---');
  const openaiApiKey = await question(`OpenAI API Key [${current?.openaiApiKey ? '***' : '未設定'}]: `) || current?.openaiApiKey as string || null;

  console.log();
  console.log('--- Google API 設定 ---');
  const googleClientId = await question(`Google Client ID [${current?.googleClientId || '未設定'}]: `) || current?.googleClientId as string || null;
  const googleClientSecret = await question(`Google Client Secret [${current?.googleClientSecret ? '***' : '未設定'}]: `) || current?.googleClientSecret as string || null;
  const googleSpreadsheetId = await question(`Google Spreadsheet ID [${current?.googleSpreadsheetId || '未設定'}]: `) || current?.googleSpreadsheetId as string || null;

  // 保存
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Settings (
      id, zoomAccountId, zoomClientId, zoomClientSecret, zoomWebhookSecretToken,
      openaiApiKey, googleClientId, googleClientSecret, googleSpreadsheetId,
      createdAt, updatedAt
    ) VALUES (
      'default', ?, ?, ?, ?, ?, ?, ?, ?,
      COALESCE((SELECT createdAt FROM Settings WHERE id = 'default'), datetime('now')),
      datetime('now')
    )
  `);

  stmt.run(
    zoomAccountId,
    zoomClientId,
    zoomClientSecret,
    zoomWebhookSecretToken,
    openaiApiKey,
    googleClientId,
    googleClientSecret,
    googleSpreadsheetId
  );

  console.log();
  console.log('═'.repeat(50));
  console.log('  ✅ 認証情報を保存しました');
  console.log('═'.repeat(50));

  // 確認表示
  console.log();
  console.log('=== 保存された設定 ===');
  console.log('Zoom Account ID:', zoomAccountId || '未設定');
  console.log('Zoom Client ID:', zoomClientId || '未設定');
  console.log('Zoom Client Secret:', zoomClientSecret ? '✓ 設定済み' : '未設定');
  console.log('Zoom Webhook Token:', zoomWebhookSecretToken ? '✓ 設定済み' : '未設定');
  console.log('OpenAI API Key:', openaiApiKey ? '✓ 設定済み' : '未設定');
  console.log('Google Client ID:', googleClientId || '未設定');
  console.log('Google Client Secret:', googleClientSecret ? '✓ 設定済み' : '未設定');
  console.log('Google Spreadsheet ID:', googleSpreadsheetId || '未設定');

  db.close();
  rl.close();
}

main().catch((error) => {
  console.error('エラー:', error);
  rl.close();
  process.exit(1);
});
