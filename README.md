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

## 開発ガイド（2026年1月版）

### 本番環境情報

| 項目 | 値 |
|------|-----|
| サーバー | tao-dx.com |
| デプロイパス | `/var/www/zoom` |
| ダッシュボードURL | `https://tao-dx.com/zoom` |
| バックエンドポート | 3002 |
| ダッシュボードポート | 3001 |
| WebhookURL | `https://tao-dx.com/zoom/webhook/zoom` |

### Nginx設定

`/etc/nginx/sites-available/tao-dx` のzoom関連部分:

```nginx
# Zoom backend API (テスト用、認証情報設定など)
location /zoom/api/test/ {
    proxy_pass http://127.0.0.1:3002/api/test/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# Zoom Webhook (録画完了イベント受信)
location /zoom/webhook/ {
    proxy_pass http://127.0.0.1:3002/webhook/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Zoom Dashboard (Next.js) - 最後に配置
location /zoom {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**重要**: `/zoom/api/*` はダッシュボード（Next.js API Routes）に、`/zoom/api/test/` と `/zoom/webhook/` はバックエンド（Express）にルーティングされます。

### マルチテナントスキーマ重要ポイント

#### Settingsモデル

```prisma
model Settings {
  id                     String   @id @default(cuid())
  organizationId         String   @unique  // ← ユニークキー
  organization           Organization @relation(fields: [organizationId], references: [id])
  // ... 認証情報フィールド
}
```

**⚠️ 重要**: `id: 'default'` でのクエリは動作しません。必ず `findFirst()` または `organizationId` で検索してください。

#### 修正済みファイル

以下のファイルはマルチテナント対応済み:

| ファイル | 修正内容 |
|---------|---------|
| `src/utils/credentials.ts` | `findFirst()` を使用 |
| `src/services/credentials/index.ts` | `findFirst()` を使用 |
| `src/server/routes/api.ts` | `findFirst()` を使用 |
| `src/queue/worker.ts` | `organizationId` 付きcompound keyを使用 |
| `dashboard/src/lib/api-auth.ts` | DBフォールバックでorganizationId取得 |

#### Recording モデル（compound key）

```prisma
model Recording {
  organizationId    String
  zoomMeetingId     String
  @@unique([organizationId, zoomMeetingId])  // ← compound unique
}
```

Workerでのupsert例:
```typescript
const dbRecording = await prisma.recording.upsert({
  where: {
    organizationId_zoomMeetingId: {
      organizationId,
      zoomMeetingId,
    },
  },
  create: { organizationId, zoomMeetingId, ... },
  update: { ... },
});
```

### バックアップと復元

#### 安定版タグ

```bash
# 現在の安定版
v1.0.0-stable-20260120

# タグから復元
git checkout v1.0.0-stable-20260120

# 開発ブランチに戻る
git checkout claude/zoom-recording-system-E63fd
```

#### ローカルバックアップブランチ

```bash
backup/stable-20260120-all-features-working
```

#### 新しいバックアップ作成

```bash
git tag -a v1.0.1-stable-YYYYMMDD -m "説明"
git branch backup/stable-YYYYMMDD-description
```

### よくある問題と解決策

#### 1. 設定が読み込まれない（プレースホルダー値が使われる）

**症状**: ログに `"spreadsheetId":"your_spreadsheet_id"` など

**原因**: `findUnique({ where: { id: 'default' } })` を使用している

**解決**: `findFirst()` に変更

```typescript
// NG
const settings = await prisma.settings.findUnique({
  where: { id: 'default' },
});

// OK
const settings = await prisma.settings.findFirst();
```

#### 2. オンボーディングで「Not Found」

**原因**: Nginxが `/zoom/api/organizations` をバックエンドにルーティングしている

**解決**: Nginx設定で `/zoom/api/test/` のみバックエンドに、他はダッシュボードにルーティング

#### 3. 「設定の取得に失敗しました」

**原因**: ユーザーに組織が紐づいていない

**解決**: `/zoom/onboarding` で組織を作成

#### 4. Webhook署名検証エラー

**原因**: バックエンドがDBから認証情報を読めていない

**解決**: `src/services/credentials/index.ts` が `findFirst()` を使用しているか確認

### デプロイ手順

```bash
# 1. 本番サーバーにSSH
ssh user@tao-dx.com

# 2. プロジェクトディレクトリに移動
cd /var/www/zoom

# 3. 変更を取得
git pull origin claude/zoom-recording-system-E63fd

# 4. バックエンドビルド
npm run build

# 5. ダッシュボードビルド
cd dashboard && npm run build && cd ..

# 6. PM2再起動
pm2 restart zoom-backend zoom-dashboard

# 7. ログ確認
pm2 logs --lines 50
```

### 動作確認済み機能（2026年1月23日）

- ✅ Zoom録画Webhook受信
- ✅ 録画ダウンロード
- ✅ YouTubeアップロード
- ✅ Whisper文字起こし
- ✅ GPT要約生成
- ✅ Google Sheets同期
- ✅ Notion同期
- ✅ マルチテナント対応
- ✅ ダッシュボード認証情報設定
- ✅ 組織作成・オンボーディング
- ✅ 詳細要約（長文・包括的要約）機能
- ✅ 文字起こし全文表示機能
- ✅ 報告書送付ステータス追跡機能
- ✅ 詳細要約ステータス追跡（GENERATING/COMPLETED/FAILED）

### 開発ブランチ

メイン開発ブランチ: `claude/continue-after-readme-EDdXs`

### 最新の変更（2026年1月23日）

#### 詳細要約機能
- `detailedSummary` フィールド: 長文の包括的な要約を保存
- `detailedSummaryStatus` フィールド: 生成状態（GENERATING/COMPLETED/FAILED）を追跡
- バックグラウンド処理でページ離脱後も生成継続
- 10秒ポーリングで自動更新

#### 報告書送付ステータス追跡機能
- `reportSentAt` フィールド: 報告書送付日時を記録
- 録画一覧に送付ステータスアイコン表示（クリックで切り替え可能）
- 報告書モーダルで連絡先（LINE等）クリック時に自動で送付済みに設定

#### タブ付き要約モーダル
- 「要約」「文字起こし」「詳細要約」の3タブ構成
- 文字起こし全文表示（追加コストなし、既に保存済み）
- 詳細要約の生成・表示・再生成機能

#### OpenAI API制限対策
- チャンクサイズを20,000文字に縮小（30,000 TPM制限対策）
- チャンク間に5秒の遅延を追加
- 要約失敗時のステータス表示修正

### 主要ファイル（最新機能関連）

| ファイル | 説明 |
|---------|------|
| `prisma/schema.prisma` | `detailedSummary`, `detailedSummaryStatus`, `reportSentAt` フィールド |
| `src/server/routes/api.ts` | 詳細要約・報告書送付APIエンドポイント |
| `src/services/summary/openai.ts` | `generateComprehensiveSummary` 関数 |
| `src/services/summary/prompts.ts` | `createComprehensiveSummaryPrompt` 関数 |
| `dashboard/src/app/recordings/page.tsx` | タブ付きモーダル、送付ステータスアイコン |
| `dashboard/src/app/api/recordings/[id]/detailed-summary/route.ts` | 詳細要約APIルート |
| `dashboard/src/app/api/recordings/[id]/report-sent/route.ts` | 送付ステータスAPIルート |
| `dashboard/src/lib/api.ts` | フロントエンドAPI関数 |

### デプロイ手順（最新）

```bash
# 1. VPSにSSH
ssh user@tao-dx.com

# 2. プロジェクトディレクトリに移動
cd /var/www/zoom

# 3. コードを取得（現在のブランチ）
git pull origin claude/continue-after-readme-EDdXs

# 4. データベーススキーマを適用
npx prisma db push

# 5. バックエンドビルド＆再起動
npm run build
pm2 restart zoom-backend

# 6. ダッシュボードビルド＆再起動
cd dashboard
npm run build
pm2 restart zoom-dashboard

# 7. ログ確認
pm2 logs --lines 50
```

### 最近のコミット履歴

```
373b0ed feat: 報告書送付ステータス追跡機能
b7b7218 feat: 詳細要約ステータス追跡（GENERATING/COMPLETED/FAILED）
f17a89d feat: 要約モーダルにタブ追加（要約・文字起こし・詳細要約）
c0e6280 feat: 詳細要約（長文・包括的要約）機能を追加
993b36e fix: 要約チャンクサイズを20,000文字に縮小（30,000 TPM制限対策）
```

## ライセンス

MIT
