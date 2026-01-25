import { z } from 'zod';
import dotenv from 'dotenv';

// .env ファイル読み込み
dotenv.config();

// 環境変数スキーマ定義
const envSchema = z.object({
  // サーバー設定
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  // Zoom API
  ZOOM_ACCOUNT_ID: z.string().min(1, 'ZOOM_ACCOUNT_ID is required'),
  ZOOM_CLIENT_ID: z.string().min(1, 'ZOOM_CLIENT_ID is required'),
  ZOOM_CLIENT_SECRET: z.string().min(1, 'ZOOM_CLIENT_SECRET is required'),
  ZOOM_WEBHOOK_SECRET_TOKEN: z.string().min(1, 'ZOOM_WEBHOOK_SECRET_TOKEN is required'),

  // Google / YouTube
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3000/auth/google/callback'),
  GOOGLE_TOKEN_PATH: z.string().default('./credentials/google-token.json'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_WHISPER_MODEL: z.string().default('whisper-1'),
  OPENAI_GPT_MODEL: z.string().default('gpt-4o-mini'),

  // Google Sheets
  GOOGLE_SPREADSHEET_ID: z.string().min(1, 'GOOGLE_SPREADSHEET_ID is required'),
  GOOGLE_SHEET_NAME: z.string().default('録画一覧'),

  // Notion (オプション)
  NOTION_API_KEY: z.string().optional(),
  NOTION_DATABASE_ID: z.string().optional(),

  // アプリケーション設定
  TEMP_DIR: z.string().default('./temp'),
  TEMP_FILE_RETENTION_MINUTES: z.string().default('60').transform(Number),
  YOUTUBE_DEFAULT_PRIVACY: z.enum(['private', 'unlisted', 'public']).default('unlisted'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// 環境変数の型
export type Env = z.infer<typeof envSchema>;

// 環境変数をパース・バリデーション
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ 環境変数のバリデーションエラー:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

// 環境変数をエクスポート
export const env = loadEnv();

// 設定値のヘルパー
export const config = {
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  zoom: {
    accountId: env.ZOOM_ACCOUNT_ID,
    clientId: env.ZOOM_CLIENT_ID,
    clientSecret: env.ZOOM_CLIENT_SECRET,
    webhookSecretToken: env.ZOOM_WEBHOOK_SECRET_TOKEN,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    tokenPath: env.GOOGLE_TOKEN_PATH,
    spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
    sheetName: env.GOOGLE_SHEET_NAME,
  },

  openai: {
    apiKey: env.OPENAI_API_KEY,
    whisperModel: env.OPENAI_WHISPER_MODEL,
    gptModel: env.OPENAI_GPT_MODEL,
  },

  notion: {
    apiKey: env.NOTION_API_KEY,
    databaseId: env.NOTION_DATABASE_ID,
    isEnabled: Boolean(env.NOTION_API_KEY && env.NOTION_DATABASE_ID),
  },

  app: {
    tempDir: env.TEMP_DIR,
    tempFileRetentionMinutes: env.TEMP_FILE_RETENTION_MINUTES,
    youtubeDefaultPrivacy: env.YOUTUBE_DEFAULT_PRIVACY,
    logLevel: env.LOG_LEVEL,
  },
} as const;
