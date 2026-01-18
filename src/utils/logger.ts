import winston from 'winston';
import { config } from '../config/env.js';

// ログフォーマット定義
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;

    // メタデータがあれば追加
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    // スタックトレースがあれば追加
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// カラー付きコンソール出力（開発環境用）
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  logFormat
);

// ロガーインスタンス作成
export const logger = winston.createLogger({
  level: config.app.logLevel,
  format: logFormat,
  defaultMeta: { service: 'zoom-automation' },
  transports: [
    // コンソール出力
    new winston.transports.Console({
      format: config.isDev ? consoleFormat : logFormat,
    }),
    // エラーログファイル
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 全ログファイル
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// 処理ステップ用のログヘルパー
export const stepLogger = {
  start: (step: string, recordingId: string, meta?: Record<string, unknown>) => {
    logger.info(`[${step}] 開始`, { recordingId, ...meta });
  },

  progress: (step: string, recordingId: string, message: string, meta?: Record<string, unknown>) => {
    logger.info(`[${step}] ${message}`, { recordingId, ...meta });
  },

  complete: (step: string, recordingId: string, meta?: Record<string, unknown>) => {
    logger.info(`[${step}] 完了`, { recordingId, ...meta });
  },

  fail: (step: string, recordingId: string, error: Error | string, meta?: Record<string, unknown>) => {
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`[${step}] 失敗: ${errorMessage}`, { recordingId, stack, ...meta });
  },
};

// Webhook用ログヘルパー
export const webhookLogger = {
  received: (event: string, meetingId: string) => {
    logger.info(`Webhook受信: ${event}`, { meetingId });
  },

  verified: (meetingId: string) => {
    logger.debug('Webhook署名検証OK', { meetingId });
  },

  rejected: (reason: string, meta?: Record<string, unknown>) => {
    logger.warn(`Webhook拒否: ${reason}`, meta);
  },
};

export default logger;
