# Zoom YouTube Automation

Zoomクラウド録画を自動処理するツール

- YouTube に限定公開でアップロード
- Whisper で音声を文字起こし
- GPT で要点を日本語要約
- Google Sheets / Notion に自動記録

## 機能概要

```
Zoom録画完了 → YouTube UP → 文字起こし → 要約 → Sheets/Notion記録
```

**クライアント別管理**: ミーティングタイトルに `【クライアント名】` を含めると自動でグループ化

## セットアップ

### 1. 前提条件

- Node.js 18以上
- Docker（Redis用）
- 各種APIアカウント

### 2. リポジトリのクローンと依存関係インストール

```bash
git clone <repository-url>
cd zoom
npm install
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
5. 取得した認証情報を `.env` に設定:
   ```
   ZOOM_ACCOUNT_ID=xxx
   ZOOM_CLIENT_ID=xxx
   ZOOM_CLIENT_SECRET=xxx
   ZOOM_WEBHOOK_SECRET_TOKEN=xxx
   ```

#### Google Cloud Console (YouTube & Sheets)

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. APIを有効化:
   - YouTube Data API v3
   - Google Sheets API
3. OAuth 2.0 クライアントID作成（デスクトップアプリ）
4. `.env` に設定:
   ```
   GOOGLE_CLIENT_ID=xxx
   GOOGLE_CLIENT_SECRET=xxx
   ```

#### OpenAI

1. [OpenAI Platform](https://platform.openai.com/) でAPIキー取得
2. `.env` に設定:
   ```
   OPENAI_API_KEY=sk-xxx
   ```

#### Notion (オプション)

1. [Notion Integrations](https://www.notion.so/my-integrations) でインテグレーション作成
2. データベースにインテグレーションを接続
3. `.env` に設定:
   ```
   NOTION_API_KEY=secret_xxx
   NOTION_DATABASE_ID=xxx
   ```

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
npm run dev
```

本番モード:
```bash
npm run build
npm start
```

## 使い方

### 自動処理

1. Zoomでミーティングを録画
2. 録画完了後、自動的に処理開始
3. 完了するとGoogle Sheetsに記録

### クライアント管理

タイトルに `【クライアント名】` を含めると自動分類:

```
【ABC商事】定例MTG     → クライアント: ABC商事
【XYZ株式会社】商談    → クライアント: XYZ株式会社
社内定例              → クライアント: (なし)
```

## フォルダ構成

```
zoom/
├── src/
│   ├── index.ts           # エントリーポイント
│   ├── config/            # 設定
│   ├── server/            # Webhookサーバー
│   ├── queue/             # ジョブキュー
│   ├── services/          # 外部API連携
│   │   ├── zoom/          # Zoom API
│   │   ├── youtube/       # YouTube API
│   │   ├── transcription/ # Whisper
│   │   ├── summary/       # GPT要約
│   │   ├── sheets/        # Google Sheets
│   │   └── notion/        # Notion
│   ├── utils/             # ユーティリティ
│   └── types/             # 型定義
├── prisma/                # DB スキーマ
├── dashboard/             # Web UI (Next.js)
└── scripts/               # セットアップスクリプト
```

## Google Sheets フォーマット

| ミーティング | クライアント | 開催日時 | YouTube URL | 要約 | Zoom URL | 時間 |
|------------|------------|---------|-------------|-----|---------|------|
| 定例MTG | ABC商事 | 2024/01/15 14:00 | https://... | 要点... | https://... | 45分 |

## 環境変数一覧

| 変数名 | 必須 | 説明 |
|-------|-----|------|
| `ZOOM_ACCOUNT_ID` | Yes | Zoom Account ID |
| `ZOOM_CLIENT_ID` | Yes | Zoom Client ID |
| `ZOOM_CLIENT_SECRET` | Yes | Zoom Client Secret |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Yes | Webhook検証トークン |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth Secret |
| `GOOGLE_SPREADSHEET_ID` | Yes | 記録先スプレッドシートID |
| `OPENAI_API_KEY` | Yes | OpenAI APIキー |
| `NOTION_API_KEY` | No | Notion APIキー |
| `NOTION_DATABASE_ID` | No | Notion データベースID |

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

## ライセンス

MIT
