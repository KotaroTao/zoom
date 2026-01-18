#!/bin/bash
# ===========================================
# エックスサーバーVPS 初期セットアップ
# ===========================================
#
# 使用方法（VPSにSSH接続後）:
#   curl -fsSL https://raw.githubusercontent.com/KotaroTao/zoom/claude/zoom-youtube-automation-BywxL/deploy/setup-vps.sh | bash
#
# または:
#   chmod +x setup-vps.sh
#   ./setup-vps.sh
#

set -e

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}===========================================
 エックスサーバーVPS 初期セットアップ
===========================================${NC}"

# -------------------------------------------
# 1. システム更新
# -------------------------------------------
echo -e "\n${YELLOW}[1/6] システム更新...${NC}"
sudo apt update && sudo apt upgrade -y

# -------------------------------------------
# 2. Node.js インストール (v20 LTS)
# -------------------------------------------
echo -e "\n${YELLOW}[2/6] Node.js インストール...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# -------------------------------------------
# 3. Redis インストール
# -------------------------------------------
echo -e "\n${YELLOW}[3/6] Redis インストール...${NC}"
if ! command -v redis-server &> /dev/null; then
    sudo apt install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
fi
echo "Redis version: $(redis-server --version)"

# -------------------------------------------
# 4. PM2 インストール
# -------------------------------------------
echo -e "\n${YELLOW}[4/6] PM2 インストール...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
echo "PM2 version: $(pm2 -v)"

# -------------------------------------------
# 5. Git インストール
# -------------------------------------------
echo -e "\n${YELLOW}[5/6] Git 確認...${NC}"
if ! command -v git &> /dev/null; then
    sudo apt install -y git
fi
echo "Git version: $(git --version)"

# -------------------------------------------
# 6. ディレクトリ作成
# -------------------------------------------
echo -e "\n${YELLOW}[6/6] ディレクトリ作成...${NC}"
sudo mkdir -p /var/www/zoom
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/www/zoom
sudo chown $USER:$USER /var/log/pm2

echo -e "\n${GREEN}===========================================
 初期セットアップ完了！
===========================================${NC}"

echo -e "
${YELLOW}次のステップ:${NC}

1. アプリをデプロイ:
   cd /var/www/zoom
   git clone -b claude/zoom-youtube-automation-BywxL https://github.com/KotaroTao/zoom.git .
   ./deploy/deploy.sh

2. 環境変数を設定:
   cp .env.example .env
   nano .env

3. Nginx設定を追加（既存のserver blockに追加）:
   sudo nano /etc/nginx/sites-available/tao-dx.com
   # deploy/nginx-zoom.conf の内容を追加
   sudo nginx -t
   sudo systemctl reload nginx

${YELLOW}インストール済み:${NC}
  - Node.js $(node -v)
  - npm $(npm -v)
  - Redis $(redis-server --version | cut -d' ' -f3)
  - PM2 $(pm2 -v)
  - Git $(git --version | cut -d' ' -f3)
"
