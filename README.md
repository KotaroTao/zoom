# Zoom Automation Project

Zoom録画 → YouTube → 文字起こし → 要約 → スプレッドシート自動記録

## プロジェクト構造

```
zoom/
├── public/           # 公開用ファイル（VPSにデプロイ）
│   ├── index.html    # メインページ
│   ├── style.css     # スタイルシート
│   ├── script.js     # JavaScript
│   └── .htaccess     # Apache設定
└── README.md
```

## エックスサーバーVPSへのデプロイ手順

### 1. SSH接続

```bash
ssh root@your-vps-ip
# または
ssh your-username@your-vps-ip
```

### 2. Webサーバーの確認

Apacheの場合:
```bash
systemctl status apache2
# または
systemctl status httpd
```

Nginxの場合:
```bash
systemctl status nginx
```

### 3. デプロイディレクトリの作成

```bash
# tao-dx.com のドキュメントルートに zoom ディレクトリを作成
# 通常は /var/www/html または /home/your-user/public_html

# Apacheの場合（一般的なパス）
mkdir -p /var/www/tao-dx.com/zoom

# または
mkdir -p /home/your-user/public_html/zoom
```

### 4. ファイルのアップロード

#### 方法A: SCP（ローカルから直接）
```bash
# ローカルマシンから実行
scp -r public/* root@your-vps-ip:/var/www/tao-dx.com/zoom/
```

#### 方法B: Git経由
```bash
# VPS上で実行
cd /var/www/tao-dx.com
git clone https://github.com/your-repo/zoom.git
# または git pull で更新
```

#### 方法C: SFTP/FTPクライアント
- FileZilla等のFTPクライアントでVPSに接続
- `public/` ディレクトリ内のファイルを `/zoom/` にアップロード

### 5. パーミッション設定

```bash
# ファイル所有者を設定
chown -R www-data:www-data /var/www/tao-dx.com/zoom
# または
chown -R apache:apache /var/www/tao-dx.com/zoom

# パーミッション設定
chmod -R 755 /var/www/tao-dx.com/zoom
chmod 644 /var/www/tao-dx.com/zoom/*.html
chmod 644 /var/www/tao-dx.com/zoom/*.css
chmod 644 /var/www/tao-dx.com/zoom/*.js
```

### 6. Webサーバー設定（必要に応じて）

#### Apache: VirtualHost設定例
```apache
# /etc/apache2/sites-available/tao-dx.com.conf

<VirtualHost *:443>
    ServerName tao-dx.com
    DocumentRoot /var/www/tao-dx.com

    <Directory /var/www/tao-dx.com>
        AllowOverride All
        Require all granted
    </Directory>

    # SSL設定
    SSLEngine on
    SSLCertificateFile /path/to/certificate.crt
    SSLCertificateKeyFile /path/to/private.key
</VirtualHost>
```

#### Nginx: 設定例
```nginx
# /etc/nginx/sites-available/tao-dx.com

server {
    listen 443 ssl;
    server_name tao-dx.com;
    root /var/www/tao-dx.com;
    index index.html;

    location /zoom/ {
        try_files $uri $uri/ /zoom/index.html;
    }

    # SSL設定
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
}
```

### 7. 動作確認

ブラウザで以下のURLにアクセス:
```
https://tao-dx.com/zoom/
```

## トラブルシューティング

### 403 Forbiddenエラー
```bash
# パーミッション確認
ls -la /var/www/tao-dx.com/zoom/

# SELinuxが有効な場合
setenforce 0  # 一時的に無効化
# または
chcon -R -t httpd_sys_content_t /var/www/tao-dx.com/zoom
```

### 404 Not Foundエラー
- ファイルパスが正しいか確認
- VirtualHostのDocumentRootを確認
- Webサーバーを再起動: `systemctl restart apache2` または `systemctl restart nginx`
