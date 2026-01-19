#!/bin/bash
# ===========================================
# Zoom Recording App - デプロイスクリプト
# ===========================================
#
# 使用方法:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh
#

set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定
APP_DIR="/var/www/zoom"
REPO_URL="https://github.com/KotaroTao/zoom.git"
BRANCH="claude/zoom-youtube-automation-BywxL"

echo -e "${GREEN}===========================================
 Zoom Recording App デプロイ
===========================================${NC}"

# -------------------------------------------
# 1. ソースコード取得/更新
# -------------------------------------------
echo -e "\n${YELLOW}[1/8] ソースコード取得...${NC}"

if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    sudo mkdir -p "$APP_DIR"
    sudo chown $USER:$USER "$APP_DIR"
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# -------------------------------------------
# 2. バックエンド依存関係インストール
# -------------------------------------------
echo -e "\n${YELLOW}[2/8] バックエンド依存関係インストール...${NC}"
npm ci --production=false

# -------------------------------------------
# 3. バックエンドビルド
# -------------------------------------------
echo -e "\n${YELLOW}[3/8] バックエンドビルド...${NC}"
npm run build

# -------------------------------------------
# 4. Prismaセットアップ
# -------------------------------------------
echo -e "\n${YELLOW}[4/8] データベースセットアップ...${NC}"
npm run db:generate
npm run db:push

# -------------------------------------------
# 5. ダッシュボード依存関係インストール
# -------------------------------------------
echo -e "\n${YELLOW}[5/8] ダッシュボード依存関係インストール...${NC}"
cd dashboard
npm ci --production=false

# -------------------------------------------
# 6. ダッシュボード環境設定
# -------------------------------------------
echo -e "\n${YELLOW}[6/8] ダッシュボード環境設定...${NC}"

# .env.localファイルを作成（存在しない場合）
if [ ! -f ".env.local" ]; then
    cat > .env.local << 'ENVEOF'
# Production環境設定

# Backend API URL (Nginx経由)
NEXT_PUBLIC_API_URL=/zoom/api

# NextAuth設定
NEXTAUTH_URL=https://tao-dx.com/zoom
NEXTAUTH_SECRET=CHANGE_THIS_TO_RANDOM_SECRET

# 管理者認証
ADMIN_EMAIL=admin@example.com
# パスワードハッシュを生成: node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
# ADMIN_PASSWORD_HASH=
ENVEOF
    echo "  .env.local を作成しました。設定を確認してください。"
else
    echo "  既存の .env.local を使用します。"
fi

# -------------------------------------------
# 7. ダッシュボードビルド
# -------------------------------------------
echo -e "\n${YELLOW}[7/8] ダッシュボードビルド...${NC}"
npm run build
cd ..

# -------------------------------------------
# 8. PM2再起動
# -------------------------------------------
echo -e "\n${YELLOW}[8/8] アプリケーション再起動...${NC}"

# PM2がインストールされているか確認
if ! command -v pm2 &> /dev/null; then
    echo "PM2をインストール中..."
    sudo npm install -g pm2
fi

# ログディレクトリ作成
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# PM2プロセス再起動
pm2 stop ecosystem.config.js 2>/dev/null || true
pm2 delete ecosystem.config.js 2>/dev/null || true
pm2 start ecosystem.config.js

# PM2を起動時に自動起動するよう設定
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo -e "\n${GREEN}===========================================
 デプロイ完了！
===========================================${NC}"

echo -e "
${YELLOW}重要な設定:${NC}

1. バックエンド .env ファイル:
   - Zoom API認証情報
   - Google API認証情報
   - OpenAI API Key
   - Redis接続情報

2. ダッシュボード .env.local ファイル:
   - NEXTAUTH_SECRET: ランダムな文字列に変更
   - ADMIN_EMAIL: 管理者メールアドレス
   - ADMIN_PASSWORD_HASH: bcryptハッシュ

   パスワードハッシュ生成:
   node -e \"console.log(require('bcryptjs').hashSync('your-password', 10))\"

3. Nginx設定:
   sudo cp deploy/nginx-zoom.conf /etc/nginx/conf.d/zoom.conf
   sudo nginx -t
   sudo systemctl reload nginx

${YELLOW}動作確認:${NC}
  ダッシュボード: https://tao-dx.com/zoom/
  ログインページ: https://tao-dx.com/zoom/login
  ヘルスチェック: https://tao-dx.com/zoom/health
  Webhook URL: https://tao-dx.com/zoom/webhook/zoom

${YELLOW}便利なコマンド:${NC}
  pm2 logs           # ログ確認
  pm2 status         # 状態確認
  pm2 restart all    # 再起動
  pm2 logs zoom-backend --lines 100  # バックエンドログ
  pm2 logs zoom-dashboard --lines 100  # ダッシュボードログ

${YELLOW}デフォルト認証情報:${NC}
  Email: admin@example.com
  Password: admin123
  ※本番環境では必ず変更してください
"
