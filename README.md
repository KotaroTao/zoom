# Zoom YouTube Automation

Zoomクラウド録画を自動処理するツール（マルチテナント対応）

- YouTube に限定公開でアップロード
- Whisper で音声を文字起こし
- GPT で要点を日本語要約
- Google Sheets / Notion に自動記録
- **複数ユーザー/組織で利用可能**

## 機能概要

```
Zoom録画完了 → YouTube UP → 文字起こし → 要約 → Sheets/Notion記録
```

**クライアント別管理**: ミーティングタイトルに `【クライアント名】` を含めると自動でグループ化

## マルチテナント対応（v2.0）

### 新機能

- **ユーザー認証**: メール/パスワードまたはGoogle OAuthでログイン
- **組織管理**: 組織を作成してチームメンバーを招待
- **権限管理**: Owner / Admin / Member / Viewer の4段階
- **テナント分離**: 各組織のデータは完全に分離

### ユーザーフロー

```
新規登録 → 組織作成 → メンバー招待 → 録画共有
                ↓
           API設定（組織ごと）
```

### 組織の役割

| 役割 | 権限 |
|------|------|
| Owner | 全権限、組織削除 |
| Admin | 設定変更、メンバー招待 |
| Member | 録画閲覧・管理 |
| Viewer | 閲覧のみ |

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Zoom Cloud    │────▶│  Express Server │────▶│   BullMQ Queue  │
│   (Webhook)     │     │   (Port 3002)   │     │    (Redis)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │   Dashboard     │◀─────────────┤
                        │   (Port 3001)   │              │
                        │    Next.js 14   │              ▼
                        └─────────────────┘     ┌─────────────────┐
                                                │     Worker      │
                                                │  ┌───────────┐  │
                                                │  │ Download  │  │
                                                │  │ YouTube   │  │
                                                │  │ Whisper   │  │
                                                │  │ GPT       │  │
                                                │  │ Sheets    │  │
                                                │  │ Notion    │  │
                                                │  └───────────┘  │
                                                └─────────────────┘
```

### 主要コンポーネント

| コンポーネント | ポート | 説明 |
|--------------|--------|------|
| Express API Server | 3002 | Webhook受信、REST API |
| Dashboard (Next.js) | 3001 | 管理画面 |
| Worker (BullMQ) | - | 録画処理ワーカー |
| Redis | 6379 | ジョブキュー |
| SQLite | - | データベース |

## フォルダ構成

```
zoom/
├── src/
│   ├── index.ts              # エントリーポイント
│   ├── config/env.ts         # 環境変数設定
│   ├── server/
│   │   ├── index.ts          # Expressサーバー
│   │   ├── routes/           # APIルート
│   │   └── middleware/       # ミドルウェア
│   ├── queue/
│   │   └── worker.ts         # ジョブ処理ワーカー ★重要
│   ├── services/
│   │   ├── zoom/             # Zoom API
│   │   │   ├── client.ts
│   │   │   └── download.ts
│   │   ├── youtube/          # YouTube API
│   │   │   └── upload.ts
│   │   ├── transcription/    # Whisper
│   │   │   └── whisper.ts
│   │   ├── summary/          # GPT要約
│   │   │   └── openai.ts
│   │   ├── sheets/           # Google Sheets ★重要
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   └── notion/           # Notion ★重要
│   │       ├── client.ts
│   │       └── types.ts
│   ├── utils/
│   │   ├── credentials.ts    # DB認証情報取得 ★重要
│   │   ├── db.ts             # Prisma client
│   │   └── logger.ts
│   └── types/
├── prisma/
│   └── schema.prisma         # DBスキーマ ★重要
├── dashboard/                # Next.js Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx      # ダッシュボード
│   │   │   ├── recordings/   # 録画一覧
│   │   │   ├── clients/      # クライアント管理
│   │   │   ├── settings/     # 設定ページ
│   │   │   └── setup/        # セットアップガイド
│   │   ├── components/
│   │   └── lib/
│   │       └── api.ts        # APIクライアント
│   └── package.json
├── scripts/                  # セットアップスクリプト
│   ├── setup-google-auth.ts  # Google OAuth認証
│   └── manage-credentials.ts # 認証情報管理
├── credentials/              # 認証情報（gitignore）
│   └── google-token.json
└── package.json
```

## セットアップ

### 1. 前提条件

- Node.js 18以上
- Docker（Redis用）
- 各種APIアカウント

### 2. リポジトリのクローンと依存関係インストール

```bash
git clone <repository-url>
cd zoom

# バックエンド
npm install

# ダッシュボード
cd dashboard
npm install
cd ..
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env` ファイルを編集して各APIキーを設定

### 4. API設定

#### Zoom Marketplace

1. [Zoom Marketplace](https://marketplace.zoom.us/) にアクセス
2. **Server-to-Server OAuth App** を作成
3. 以下のスコープを追加:
   - `cloud_recording:read:admin`
   - `cloud_recording:write:admin`
4. Webhook設定:
   - Event types: `recording.completed`
   - Endpoint URL: `https://your-domain.com/webhook/zoom`
5. 取得した認証情報を `.env` または ダッシュボードの設定画面で設定

#### Google Cloud Console (YouTube & Sheets)

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. APIを有効化:
   - YouTube Data API v3
   - Google Sheets API
3. OAuth 2.0 クライアントID作成（デスクトップアプリ）
4. 認証情報を設定

#### OpenAI

1. [OpenAI Platform](https://platform.openai.com/) でAPIキー取得
2. 認証情報を設定

#### Notion (オプション)

1. [Notion Integrations](https://www.notion.so/my-integrations) でインテグレーション作成
2. データベースにインテグレーションを接続
3. 認証情報を設定

### 5. データベース初期化

```bash
npm run db:generate
npm run db:push
```

### 6. Redis起動

```bash
docker-compose up -d redis
```

### 7. Google認証

初回のみ実行:

```bash
npx tsx scripts/setup-google-auth.ts
```

ブラウザで認証を完了

### 8. アプリケーション起動

開発モード:
```bash
# バックエンド
npm run dev

# 別ターミナルでダッシュボード
cd dashboard
npm run dev
```

本番モード:
```bash
# バックエンドビルド
npm run build
npm start

# ダッシュボードビルド
cd dashboard
npm run build
npm start
```

## VPS本番環境デプロイ

### PM2プロセス管理

本番環境では PM2 で管理しています。

```bash
# VPSにSSH接続後
cd /var/www/zoom

# コードを更新
git pull origin main

# バックエンドのビルドと再起動
npm run build
pm2 restart zoom-api

# ダッシュボードのビルドと再起動
cd dashboard
npm run build
pm2 restart zoom-dashboard

# ログ確認
pm2 logs zoom-api
pm2 logs zoom-dashboard
```

### PM2設定

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'zoom-api',
      script: 'dist/index.js',
      cwd: '/var/www/zoom',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'zoom-dashboard',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/zoom/dashboard',
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

## Google Sheets 設定要件

### シート名

**重要**: スプレッドシートの最初のシートタブ名を `Sheet1` にする必要があります。
- デフォルトの日本語名「シート1」ではエラーになります
- タブをダブルクリックして `Sheet1` にリネームしてください

### ヘッダー（自動設定）

| ミーティング | クライアント | 開催日時 | YouTube URL | 要約 | Zoom URL | 時間（分） | ホスト | 処理日時 |
|------------|------------|---------|-------------|-----|---------|----------|-------|---------|

### 共有設定

スプレッドシートをサービスアカウントのメールアドレス（または認証したGoogleアカウント）と共有し、**編集者**権限を付与してください。

## Notion データベース設定要件

### 必須プロパティ

Notionデータベースには以下のプロパティを**正確な名前で**作成してください：

| プロパティ名 | 種類 | 説明 |
|-------------|------|------|
| タイトル | タイトル | ミーティングタイトル（デフォルトのタイトル列） |
| クライアント | テキスト | クライアント名 |
| 開催日時 | 日付 | ミーティング日時 |
| YouTube | URL | YouTube動画URL |
| Zoom URL | URL | 元のZoom録画URL |
| 時間（分） | 数値 | 録画時間（分単位） |
| ホスト | テキスト | ホストメールアドレス |
| ステータス | セレクト | 処理ステータス（COMPLETED, FAILED, PENDING） |

### インテグレーション接続

1. データベースページ右上の `...` → `接続` をクリック
2. 作成したインテグレーションを選択して接続

## 認証情報管理

### ダッシュボードから設定（推奨）

1. ダッシュボード ( https://your-domain.com/zoom/settings ) にアクセス
2. 各サービスの認証情報を入力
3. 接続テストで確認

### コマンドラインから設定

```bash
# 認証情報の確認
npx tsx scripts/manage-credentials.ts list

# 認証情報の設定
npx tsx scripts/manage-credentials.ts set zoom_account_id YOUR_ID

# 利用可能なキー:
# zoom_account_id, zoom_client_id, zoom_client_secret, zoom_webhook_secret_token
# openai_api_key
# google_client_id, google_client_secret, google_spreadsheet_id
# notion_api_key, notion_database_id
```

### 認証情報の優先順位

1. DBに保存された認証情報（ダッシュボードで設定）
2. 環境変数（.envファイル）

`src/utils/credentials.ts` で実装されています。

## トラブルシューティング

### Webhookが届かない

- ngrokなどでローカル環境を公開
- Zoom MarketplaceでEndpoint URLを確認
- Webhook Secret Tokenが正しいか確認

### YouTube認証エラー

```bash
npx tsx scripts/setup-google-auth.ts
```

で再認証

### Redis接続エラー

```bash
docker-compose up -d redis
docker-compose logs redis
```

### Google Sheets エラー: `Unable to parse range: Sheet1!A:I`

シート名が「Sheet1」になっていない可能性があります。スプレッドシートの最初のタブ名を `Sheet1` にリネームしてください。

### Notion エラー: `XXX is not a property that exists`

Notionデータベースのプロパティ名がコードの期待値と一致していません。上記の「Notion データベース設定要件」を確認し、プロパティ名を正確に設定してください。

## 開発ノート

### 主要ファイル

| ファイル | 説明 |
|---------|------|
| `src/queue/worker.ts` | 録画処理の全ステップを実行 |
| `src/utils/credentials.ts` | DBから認証情報を取得（環境変数フォールバック） |
| `src/services/sheets/client.ts` | Google Sheets API連携 |
| `src/services/notion/client.ts` | Notion API連携 |
| `prisma/schema.prisma` | データベーススキーマ |
| `dashboard/src/lib/api.ts` | ダッシュボードAPIクライアント |

### DB認証情報の使用

ワーカーは `getCredentials()` を使用してDBから認証情報を取得します：

```typescript
// src/queue/worker.ts
import { getCredentials } from '../utils/credentials.js';

// 同期ステップで使用
const credentials = await getCredentials();

if (credentials.googleSpreadsheetId) {
  await appendRow(credentials.googleSpreadsheetId, rowData);
}

if (credentials.notionApiKey && credentials.notionDatabaseId) {
  await createMeetingPageWithCredentials(data, credentials.notionApiKey, credentials.notionDatabaseId);
}
```

### 同期ステータス

各録画の同期ステータスはDBに保存され、ダッシュボードに表示されます：

- `youtubeSuccess`: YouTubeアップロード成功
- `sheetsSuccess`: Google Sheets書き込み成功
- `notionSuccess`: Notion書き込み成功
- `sheetsError`, `notionError`: エラーメッセージ

## 環境変数一覧

### 認証関連（ダッシュボード）

| 変数名 | 必須 | 説明 |
|-------|-----|------|
| `NEXTAUTH_URL` | Yes | ダッシュボードのURL (例: https://example.com) |
| `NEXTAUTH_SECRET` | Yes | セッション暗号化キー（32文字以上推奨） |
| `GOOGLE_CLIENT_ID` | No | Google OAuth用 Client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth用 Secret |

### API関連（バックエンド）

| 変数名 | 必須 | 説明 |
|-------|-----|------|
| `ZOOM_ACCOUNT_ID` | No* | Zoom Account ID |
| `ZOOM_CLIENT_ID` | No* | Zoom Client ID |
| `ZOOM_CLIENT_SECRET` | No* | Zoom Client Secret |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | No* | Webhook検証トークン |
| `OPENAI_API_KEY` | No* | OpenAI APIキー |
| `NOTION_API_KEY` | No | Notion APIキー |
| `NOTION_DATABASE_ID` | No | Notion データベースID |
| `REDIS_HOST` | No | Redisホスト（デフォルト: localhost） |
| `REDIS_PORT` | No | Redisポート（デフォルト: 6379） |
| `PORT` | No | APIサーバーポート（デフォルト: 3002） |

*ダッシュボードで設定する場合は環境変数は不要

## ライセンス

MIT
