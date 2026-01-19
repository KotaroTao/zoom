/**
 * 認証情報設定スクリプト（非対話式）
 *
 * 使用方法:
 *   npx tsx scripts/set-credential.ts <key> <value>
 *
 * 例:
 *   npx tsx scripts/set-credential.ts zoomWebhookSecretToken "your_token_here"
 *   npx tsx scripts/set-credential.ts zoomAccountId "your_account_id"
 *
 * 利用可能なキー:
 *   - zoomAccountId
 *   - zoomClientId
 *   - zoomClientSecret
 *   - zoomWebhookSecretToken
 *   - openaiApiKey
 *   - googleClientId
 *   - googleClientSecret
 *   - googleSpreadsheetId
 */

import * as path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.cwd(), 'prisma', 'data.db');

const VALID_KEYS = [
  'zoomAccountId',
  'zoomClientId',
  'zoomClientSecret',
  'zoomWebhookSecretToken',
  'openaiApiKey',
  'googleClientId',
  'googleClientSecret',
  'googleSpreadsheetId',
  'notionApiKey',
  'notionDatabaseId',
];

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('使用方法: npx tsx scripts/set-credential.ts <key> <value>');
    console.log();
    console.log('利用可能なキー:');
    VALID_KEYS.forEach((key) => console.log(`  - ${key}`));
    console.log();
    console.log('例:');
    console.log('  npx tsx scripts/set-credential.ts zoomWebhookSecretToken "your_token"');
    return;
  }

  if (args.length === 1 && args[0] === '--show') {
    showCurrentSettings();
    return;
  }

  if (args.length < 2) {
    console.error('エラー: キーと値の両方を指定してください');
    process.exit(1);
  }

  const [key, value] = args;

  if (!VALID_KEYS.includes(key)) {
    console.error(`エラー: 無効なキー "${key}"`);
    console.error('利用可能なキー:', VALID_KEYS.join(', '));
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  // 現在の設定を確認、なければ作成
  const existing = db.prepare('SELECT id FROM Settings WHERE id = ?').get('default');
  if (!existing) {
    db.prepare(`INSERT INTO Settings (id, createdAt, updatedAt) VALUES ('default', datetime('now'), datetime('now'))`).run();
  }

  // 値を更新
  db.prepare(`UPDATE Settings SET ${key} = ?, updatedAt = datetime('now') WHERE id = 'default'`).run(value);

  console.log(`✅ ${key} を設定しました`);

  // 確認
  const updated = db.prepare(`SELECT ${key} FROM Settings WHERE id = 'default'`).get() as Record<string, unknown>;
  const savedValue = updated[key] as string;

  if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
    console.log(`   値: ${savedValue ? savedValue.substring(0, 8) + '...' : 'null'}`);
  } else {
    console.log(`   値: ${savedValue}`);
  }

  db.close();
}

function showCurrentSettings(): void {
  const db = new Database(DB_PATH, { readonly: true });
  const settings = db.prepare('SELECT * FROM Settings WHERE id = ?').get('default') as Record<string, unknown> | undefined;

  console.log('═'.repeat(50));
  console.log('  現在の認証情報設定');
  console.log('═'.repeat(50));
  console.log();

  if (!settings) {
    console.log('設定がありません');
    db.close();
    return;
  }

  VALID_KEYS.forEach((key) => {
    const value = settings[key] as string | null;
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
      console.log(`${key}: ${value ? value.substring(0, 8) + '...' : '未設定'}`);
    } else {
      console.log(`${key}: ${value || '未設定'}`);
    }
  });

  db.close();
}

main();
