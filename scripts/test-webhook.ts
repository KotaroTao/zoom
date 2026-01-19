/**
 * Zoom Webhook テストスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-webhook.ts
 *
 * ローカルのWebhookサーバーにテストペイロードを送信します。
 * DBから認証情報を取得して署名を生成します。
 */

import axios from 'axios';
import * as crypto from 'crypto';
import * as path from 'path';
import 'dotenv/config';
import Database from 'better-sqlite3';

const WEBHOOK_URL = process.env.WEBHOOK_TEST_URL || 'http://localhost:3000/webhook/zoom';
const DB_PATH = path.join(process.cwd(), 'prisma', 'data.db');

// DBから認証情報を取得（フォールバック: 環境変数）
function getWebhookSecret(): string {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const settings = db.prepare('SELECT zoomWebhookSecretToken FROM Settings WHERE id = ?').get('default') as { zoomWebhookSecretToken?: string } | undefined;
    db.close();

    if (settings?.zoomWebhookSecretToken) {
      console.log('📋 DBからWebhook Secret Tokenを取得');
      return settings.zoomWebhookSecretToken;
    }
  } catch (error) {
    console.warn('⚠️ DB接続エラー、環境変数を使用');
  }
  console.log('📋 環境変数からWebhook Secret Tokenを使用');
  return process.env.ZOOM_WEBHOOK_SECRET_TOKEN || 'test_secret';
}

// テスト用のrecording.completedペイロード
const testPayload = {
  event: 'recording.completed',
  event_ts: Date.now(),
  payload: {
    account_id: 'test_account_id',
    object: {
      id: 123456789,
      uuid: 'test-meeting-uuid-' + Date.now(),
      host_id: 'test_host_id',
      host_email: 'host@example.com',
      topic: '【テストクライアント】サンプルミーティング',
      type: 2,
      start_time: new Date().toISOString(),
      timezone: 'Asia/Tokyo',
      duration: 30,
      total_size: 104857600, // 100MB
      recording_count: 2,
      share_url: 'https://zoom.us/rec/share/test-share-url',
      recording_files: [
        {
          id: 'file-001',
          meeting_id: '123456789',
          recording_start: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          recording_end: new Date().toISOString(),
          file_type: 'MP4',
          file_extension: 'mp4',
          file_size: 94371840, // 90MB
          play_url: 'https://zoom.us/rec/play/test-play-url',
          download_url: 'https://zoom.us/rec/download/test-download-url',
          status: 'completed',
          recording_type: 'shared_screen_with_speaker_view',
        },
        {
          id: 'file-002',
          meeting_id: '123456789',
          recording_start: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          recording_end: new Date().toISOString(),
          file_type: 'M4A',
          file_extension: 'm4a',
          file_size: 10485760, // 10MB
          play_url: 'https://zoom.us/rec/play/test-audio-url',
          download_url: 'https://zoom.us/rec/download/test-audio-url',
          status: 'completed',
          recording_type: 'audio_only',
        },
      ],
      password: 'test123',
    },
  },
};

// Webhook署名を生成
function generateSignature(payload: string, timestamp: string, secret: string): string {
  const message = `v0:${timestamp}:${payload}`;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  return `v0=${hash}`;
}

async function sendTestWebhook(): Promise<void> {
  console.log('═'.repeat(50));
  console.log('  Zoom Webhook テスト送信');
  console.log('═'.repeat(50));
  console.log();
  console.log(`送信先: ${WEBHOOK_URL}`);
  console.log(`イベント: ${testPayload.event}`);
  console.log(`ミーティング: ${testPayload.payload.object.topic}`);
  console.log();

  // DBから認証情報を取得
  const webhookSecret = getWebhookSecret();

  const payloadString = JSON.stringify(testPayload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = generateSignature(payloadString, timestamp, webhookSecret);

  try {
    const response = await axios.post(WEBHOOK_URL, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-zm-request-timestamp': timestamp,
        'x-zm-signature': signature,
      },
      timeout: 10000,
    });

    console.log('✅ Webhook送信成功');
    console.log(`   ステータス: ${response.status}`);
    console.log(`   レスポンス:`, response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Webhook送信失敗');
      console.error(`   ステータス: ${error.response?.status || 'N/A'}`);
      console.error(`   エラー: ${error.message}`);
      if (error.response?.data) {
        console.error(`   レスポンス:`, error.response.data);
      }
    } else {
      console.error('❌ エラー:', error);
    }
  }
}

// URL検証テスト
async function sendValidationTest(): Promise<void> {
  console.log();
  console.log('─'.repeat(50));
  console.log('  URL検証テスト');
  console.log('─'.repeat(50));
  console.log();

  const validationPayload = {
    event: 'endpoint.url_validation',
    payload: {
      plainToken: 'test_plain_token_' + Date.now(),
    },
  };

  try {
    const response = await axios.post(WEBHOOK_URL, validationPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('✅ URL検証成功');
    console.log(`   ステータス: ${response.status}`);
    console.log(`   レスポンス:`, response.data);

    // 検証
    if (response.data.plainToken === validationPayload.payload.plainToken) {
      console.log('✅ plainToken一致');
    } else {
      console.log('❌ plainToken不一致');
    }

    if (response.data.encryptedToken) {
      console.log('✅ encryptedToken生成済み');
    } else {
      console.log('❌ encryptedTokenなし');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ URL検証失敗');
      console.error(`   ステータス: ${error.response?.status || 'N/A'}`);
      console.error(`   エラー: ${error.message}`);
    } else {
      console.error('❌ エラー:', error);
    }
  }
}

// メイン実行
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--validation') || args.includes('-v')) {
    await sendValidationTest();
  } else if (args.includes('--both') || args.includes('-b')) {
    await sendValidationTest();
    await sendTestWebhook();
  } else {
    await sendTestWebhook();
  }

  console.log();
  console.log('═'.repeat(50));
  console.log('  テスト完了');
  console.log('═'.repeat(50));
}

main().catch(console.error);
