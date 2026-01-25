/**
 * YouTube動画ダウンロード処理
 * yt-dlpを使用してYouTubeから動画をダウンロード
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface YouTubeDownloadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

/**
 * YouTube動画をダウンロード
 * @param youtubeUrl YouTube動画のURL
 * @param outputFileName 出力ファイル名（拡張子なし）
 */
export async function downloadFromYouTube(
  youtubeUrl: string,
  outputFileName: string
): Promise<YouTubeDownloadResult> {
  const tempDir = config.app.tempDir;

  // ファイル名をサニタイズ
  const safeFileName = outputFileName
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\s-]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);

  const outputPath = path.join(tempDir, `${safeFileName}.mp4`);

  logger.info('YouTubeダウンロード開始', {
    url: youtubeUrl,
    outputPath,
  });

  try {
    // 出力ディレクトリが存在することを確認
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // yt-dlpコマンドを実行
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', outputPath,
        '--no-playlist',
        '--no-check-certificate',
        youtubeUrl,
      ];

      logger.debug('yt-dlp実行', { args });

      const process = spawn('yt-dlp', args);

      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        logger.debug('yt-dlp stdout:', { output: output.trim() });
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.debug('yt-dlp stderr:', { output: data.toString().trim() });
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp終了コード: ${code}\n${stderr}`));
        }
      });

      process.on('error', (err) => {
        reject(new Error(`yt-dlp実行エラー: ${err.message}`));
      });
    });

    // ファイルサイズを確認
    if (!fs.existsSync(outputPath)) {
      throw new Error('ダウンロードファイルが見つかりません');
    }

    const stats = fs.statSync(outputPath);

    logger.info('YouTubeダウンロード完了', {
      filePath: outputPath,
      fileSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    });

    return {
      success: true,
      filePath: outputPath,
      fileSize: stats.size,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('YouTubeダウンロード失敗', {
      url: youtubeUrl,
      error: errorMessage,
    });

    // 部分的にダウンロードされたファイルを削除
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * YouTube動画IDからURLを生成
 */
export function getYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * YouTube URLから動画IDを抽出
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
