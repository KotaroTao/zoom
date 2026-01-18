# デプロイ手順（エックスサーバーVPS）

`https://tao-dx.com/zoom/` でアプリを公開する手順

## 前提条件

- エックスサーバーVPSにSSHアクセス可能
- `tao-dx.com` がVPSに向いている
- Nginxが動作中

---

## 1. VPSに接続

```bash
ssh username@tao-dx.com
```

---

## 2. 初期セットアップ（初回のみ）

```bash
# Node.js, Redis, PM2 をインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs redis-server git
sudo npm install -g pm2

# Redis起動
sudo systemctl enable redis-server
sudo systemctl start redis-server

# ディレクトリ作成
sudo mkdir -p /var/www/zoom /var/log/pm2
sudo chown $USER:$USER /var/www/zoom /var/log/pm2
```

---

## 3. アプリをデプロイ

```bash
cd /var/www/zoom

# 初回
git clone -b claude/zoom-youtube-automation-BywxL https://github.com/KotaroTao/zoom.git .

# 更新時
git pull origin claude/zoom-youtube-automation-BywxL

# 依存関係インストール & ビルド
npm ci
npm run build
npm run db:generate
npm run db:push

cd dashboard
npm ci
npm run build
cd ..
```

---

## 4. 環境変数を設定

```bash
cp .env.example .env
nano .env
```

**必須項目:**

```env
# サーバー
PORT=3000
NODE_ENV=production

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Zoom
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_WEBHOOK_SECRET_TOKEN=your_webhook_token

# Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id

# OpenAI
OPENAI_API_KEY=sk-your_openai_key

# Notion (オプション)
NOTION_API_KEY=secret_your_notion_key
NOTION_DATABASE_ID=your_database_id
```

---

## 5. Google認証（初回のみ）

```bash
# ローカルPCで実行（ブラウザが必要）
npx tsx scripts/setup-google-auth.ts

# 生成された credentials/google-token.json をVPSにコピー
scp credentials/google-token.json username@tao-dx.com:/var/www/zoom/credentials/
```

---

## 6. Nginx設定

既存のNginx設定ファイルに追加:

```bash
sudo nano /etc/nginx/sites-available/tao-dx.com
```

以下を `server` ブロック内に追加:

```nginx
# ダッシュボード
location /zoom {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# 静的ファイル
location /zoom/_next {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_cache_valid 200 1d;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# Webhook
location /zoom/webhook {
    proxy_pass http://127.0.0.1:3000/webhook;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50M;
}

# API
location /zoom/api {
    rewrite ^/zoom/api(.*)$ /api$1 break;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

設定を適用:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. PM2でアプリ起動

```bash
cd /var/www/zoom

# 起動
pm2 start ecosystem.config.js

# 自動起動設定
pm2 save
pm2 startup
# 表示されたコマンドを実行
```

---

## 8. 動作確認

- ダッシュボード: https://tao-dx.com/zoom/
- ヘルスチェック: https://tao-dx.com/zoom/api/health

---

## Zoom Webhook設定

Zoom Marketplaceで以下を設定:

- **Event Subscription URL**: `https://tao-dx.com/zoom/webhook/zoom`
- **Event Types**: `recording.completed`

---

## 便利なコマンド

```bash
# ログ確認
pm2 logs

# 状態確認
pm2 status

# 再起動
pm2 restart all

# 停止
pm2 stop all

# 更新デプロイ
cd /var/www/zoom
git pull
npm ci && npm run build
cd dashboard && npm ci && npm run build && cd ..
pm2 restart all
```

---

## トラブルシューティング

### アプリが起動しない

```bash
pm2 logs zoom-backend --lines 100
pm2 logs zoom-dashboard --lines 100
```

### Nginxエラー

```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Redis接続エラー

```bash
sudo systemctl status redis-server
redis-cli ping
```
