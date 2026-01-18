import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';
import { logger } from './logger.js';

/**
 * 一時ファイル管理ユーティリティ
 */

/**
 * 一時ディレクトリのパスを取得
 */
export function getTempDir(): string {
  return path.resolve(config.app.tempDir);
}

/**
 * 録画用の一時ファイルパスを生成
 * @param recordingId 録画ID
 * @param extension ファイル拡張子
 */
export function getTempFilePath(recordingId: string, extension: string): string {
  const sanitizedId = recordingId.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(getTempDir(), `${sanitizedId}.${extension}`);
}

/**
 * 一時ディレクトリを初期化（存在しなければ作成）
 */
export async function ensureTempDir(): Promise<void> {
  const tempDir = getTempDir();
  try {
    await fs.mkdir(tempDir, { recursive: true });
    logger.debug(`一時ディレクトリ確認: ${tempDir}`);
  } catch (error) {
    logger.error('一時ディレクトリの作成に失敗', { error, tempDir });
    throw error;
  }
}

/**
 * 一時ファイルを削除
 * @param filePath ファイルパス
 */
export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    logger.debug(`一時ファイル削除: ${filePath}`);
  } catch (error) {
    // ファイルが存在しない場合は無視
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn(`一時ファイルの削除に失敗: ${filePath}`, { error });
    }
  }
}

/**
 * 古い一時ファイルをクリーンアップ
 * @param retentionMinutes 保持時間（分）
 */
export async function cleanupOldTempFiles(
  retentionMinutes: number = config.app.tempFileRetentionMinutes
): Promise<number> {
  const tempDir = getTempDir();
  const cutoffTime = Date.now() - retentionMinutes * 60 * 1000;
  let deletedCount = 0;

  try {
    const files = await fs.readdir(tempDir);

    for (const file of files) {
      // .gitkeep は削除しない
      if (file === '.gitkeep') continue;

      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime.getTime() < cutoffTime) {
        await fs.unlink(filePath);
        deletedCount++;
        logger.debug(`古い一時ファイルを削除: ${file}`);
      }
    }

    if (deletedCount > 0) {
      logger.info(`一時ファイルクリーンアップ完了: ${deletedCount}件削除`);
    }
  } catch (error) {
    logger.error('一時ファイルのクリーンアップに失敗', { error });
  }

  return deletedCount;
}

/**
 * ファイルサイズを取得
 * @param filePath ファイルパス
 * @returns ファイルサイズ（バイト）
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * ファイルサイズを人間が読める形式に変換
 * @param bytes バイト数
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * ファイルが存在するか確認
 * @param filePath ファイルパス
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
