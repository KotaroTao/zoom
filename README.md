# Zoom YouTube Automation

Zoomクラウド録画を自動処理し、YouTube アップロード、文字起こし、要約生成、クライアント別管理を行うツール。

## 機能

- **自動処理**: Zoom録画完了時にWebhookで自動トリガー
- **YouTubeアップロード**: 限定公開で自動アップロード
- **文字起こし**: OpenAI Whisperで日本語文字起こし
- **AI要約**: GPT-4で要約・決定事項・アクションアイテムを抽出
- **クライアント管理**: クライアント別に履歴を自動整理、累積サマリー生成
- **Notion連携**: ミーティング情報をNotionデータベースに自動記録
- **Google Sheets連携**: スプレッドシートにバックアップ
- **Google Calendar連携**: カレンダーイベントに録画情報を追加
- **Slack通知**: 処理完了・エラーをSlackに通知
- **Webダッシュボード**: ブラウザで履歴閲覧・管理

## システム構成

```
Zoom (録画完了)
    ↓ Webhook
FastAPI Server
    ↓
Background Worker
    ├── Zoom API (録画ダウンロード)
    ├── YouTube API (アップロード)
    ├── OpenAI Whisper (文字起こし)
    ├── OpenAI GPT (要約)
    ├── Notion API (記録)
    ├── Google Sheets API (バックアップ)
    ├── Google Calendar API (イベント更新)
    └── Slack API (通知)
```

## セットアップ

### 1. 前提条件

- Python 3.11+
- Node.js 18+ (フロントエンド用)
- ffmpeg (音声処理用)
- Redis (オプション: バックグラウンドジョブ用)

### 2. クローンとインストール

```bash
git clone <repository-url>
cd zoom

# Python依存関係
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# フロントエンド依存関係
cd frontend
npm install
cd ..
```

### 3. 環境変数設定

```bash
cp .env.example .env
```

`.env` ファイルを編集して各APIキーを設定:

```bash
# Zoom
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_WEBHOOK_SECRET_TOKEN=your_webhook_secret

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Google
GOOGLE_APPLICATION_CREDENTIALS=credentials/service_account.json
YOUTUBE_CLIENT_SECRET_FILE=credentials/youtube_oauth.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_CALENDAR_ID=primary

# Notion
NOTION_API_KEY=secret_your_notion_key
NOTION_CLIENT_DB_ID=your_client_db_id
NOTION_MEETING_DB_ID=your_meeting_db_id

# Slack (オプション)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SLACK_ENABLED=true

# App
APP_SECRET_KEY=your-secret-key
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your-password
```

### 4. Google認証情報の設定

#### サービスアカウント (Sheets, Calendar用)

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. Google Sheets API と Google Calendar API を有効化
3. サービスアカウントを作成
4. JSONキーをダウンロードして `credentials/service_account.json` に保存
5. スプレッドシートとカレンダーをサービスアカウントに共有

#### OAuth認証 (YouTube用)

1. OAuth 2.0 クライアントIDを作成
2. JSONをダウンロードして `credentials/youtube_oauth.json` に保存
3. 初回起動時にブラウザ認証が必要

### 5. Zoom Webhook設定

1. [Zoom App Marketplace](https://marketplace.zoom.us/) でアプリ作成
2. Event Subscriptions で `recording.completed` を登録
3. Webhook URL: `https://your-domain.com/webhook/zoom`
4. Secret Token を `.env` に設定

### 6. Notion設定

1. [Notion Integrations](https://www.notion.so/my-integrations) でIntegration作成
2. 以下のデータベースを作成:
   - **クライアント**: 名前, ステータス, ミーティング回数, 最終ミーティング
   - **ミーティング**: タイトル, 開催日時, YouTube URL, Zoom録画URL, クライアント(リレーション)
3. データベースをIntegrationに共有
4. データベースIDを `.env` に設定

### 7. 起動

#### 開発環境

```bash
# バックエンド
uvicorn src.main:app --reload --port 8000

# フロントエンド (別ターミナル)
cd frontend
npm run dev
```

#### Docker

```bash
docker-compose up -d
```

## 使い方

### クライアント自動識別

以下の方法でクライアントを自動識別:

1. **タイトルパターン**: ミーティングタイトルに `【クライアント名】` を含める
2. **定期ミーティング**: 同じZoom会議URLは自動で同一クライアントとして認識
3. **AI推測**: 会話内容から企業名を自動検出

### ダッシュボード

- `http://localhost:3000` (開発時)
- `http://localhost:8000` (本番/Docker時)

機能:
- 処理状況のリアルタイム表示
- クライアント別ミーティング履歴
- 累積サマリーの閲覧・更新
- ミーティング詳細(要約、決定事項、アクション)
- クライアント手動登録・割り当て

### API

```bash
# ヘルスチェック
curl http://localhost:8000/health

# ダッシュボード統計
curl http://localhost:8000/api/dashboard/stats

# クライアント一覧
curl http://localhost:8000/api/clients

# ミーティング一覧
curl http://localhost:8000/api/meetings
```

## カスタマイズ

### プロンプト編集

`prompts/` ディレクトリ内のファイルを編集して要約スタイルを変更:

- `meeting_summary.txt` - ミーティング要約
- `extract_decisions.txt` - 決定事項抽出
- `extract_actions.txt` - アクションアイテム抽出
- `cumulative_summary.txt` - 累積サマリー
- `identify_client.txt` - クライアント識別

## ディレクトリ構成

```
zoom/
├── src/
│   ├── main.py              # FastAPIアプリ
│   ├── config.py            # 設定
│   ├── database.py          # SQLiteモデル
│   ├── api/                  # ダッシュボードAPI
│   ├── webhook/              # Zoom Webhook
│   ├── services/             # 各種サービス
│   ├── workers/              # バックグラウンド処理
│   ├── models/               # Pydanticモデル
│   └── utils/                # ユーティリティ
├── frontend/                 # Vue.jsダッシュボード
├── prompts/                  # AIプロンプト
├── credentials/              # 認証情報 (gitignore)
├── data/                     # SQLite DB
├── downloads/                # 一時ダウンロード
├── logs/                     # ログファイル
├── .env.example              # 環境変数テンプレート
├── requirements.txt          # Python依存関係
├── Dockerfile
└── docker-compose.yml
```

## トラブルシューティング

### YouTube認証エラー

```bash
# トークンファイルを削除して再認証
rm credentials/youtube_token.json
# 再起動してブラウザ認証
```

### Whisper大容量ファイルエラー

25MB以上のファイルは自動的に音声を抽出・圧縮します。
ffmpegがインストールされていることを確認してください。

### Webhook受信できない

1. ドメインがHTTPSであることを確認
2. Zoom App Marketplaceでステータスが「Active」であることを確認
3. ログで署名検証エラーがないか確認

## ライセンス

MIT License
