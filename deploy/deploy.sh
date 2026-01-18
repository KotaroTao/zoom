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
echo -e "\n${YELLOW}[1/7] ソースコード取得...${NC}"

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
echo -e "\n${YELLOW}[2/7] バックエンド依存関係インストール...${NC}"
npm ci --production=false

# -------------------------------------------
# 3. バックエンドビルド
# -------------------------------------------
echo -e "\n${YELLOW}[3/7] バックエンドビルド...${NC}"
npm run build

# -------------------------------------------
# 4. Prismaセットアップ
# -------------------------------------------
echo -e "\n${YELLOW}[4/7] データベースセットアップ...${NC}"
npm run db:generate
npm run db:push

# -------------------------------------------
# 5. ダッシュボード依存関係インストール
# -------------------------------------------
echo -e "\n${YELLOW}[5/7] ダッシュボード依存関係インストール...${NC}"
cd dashboard
npm ci --production=false

# -------------------------------------------
# 6. ダッシュボードビルド
# -------------------------------------------
echo -e "\n${YELLOW}[6/7] ダッシュボードビルド...${NC}"
npm run build
cd ..

# -------------------------------------------
# 7. PM2再起動
# -------------------------------------------
echo -e "\n${YELLOW}[7/7] アプリケーション再起動...${NC}"

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
${YELLOW}次のステップ:${NC}
1. .env ファイルを設定:
   cp .env.example .env
   nano .env

2. Google認証を実行（初回のみ）:
   npx tsx scripts/setup-google-auth.ts

3. Nginx設定を追加:
   sudo cp deploy/nginx-zoom.conf /etc/nginx/conf.d/zoom.conf
   sudo nginx -t
   sudo systemctl reload nginx

4. 動作確認:
   https://tao-dx.com/zoom/

${YELLOW}便利なコマンド:${NC}
  pm2 logs           # ログ確認
  pm2 status         # 状態確認
  pm2 restart all    # 再起動
"
