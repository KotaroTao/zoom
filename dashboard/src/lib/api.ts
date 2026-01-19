/**
 * API クライアント
 */

// APIベースURL（環境変数またはデフォルト）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

/**
 * 統計情報
 */
export interface Stats {
  totalRecordings: number;
  completedRecordings: number;
  failedRecordings: number;
  totalClients: number;
  totalDurationMinutes: number;
  thisWeekRecordings: number;
  completionRate: number;
}

/**
 * 録画
 */
export interface Recording {
  id: string;
  zoomMeetingId: string;
  title: string;
  clientName: string | null;
  hostEmail: string | null;
  duration: number | null;
  meetingDate: string;
  youtubeUrl: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 録画詳細
 */
export interface RecordingDetail extends Recording {
  zoomMeetingUuid: string | null;
  zoomUrl: string;
  youtubeVideoId: string | null;
  transcript: string | null;
  summary: string | null;
  sheetRowNumber: number | null;
  notionPageId: string | null;
  downloadedAt: string | null;
  uploadedAt: string | null;
  transcribedAt: string | null;
  summarizedAt: string | null;
  syncedAt: string | null;
}

/**
 * 処理ログ
 */
export interface ProcessLog {
  id: string;
  recordingId: string;
  step: string;
  status: string;
  message: string | null;
  duration: number | null;
  createdAt: string;
}

/**
 * クライアント
 */
export interface Client {
  name: string;
  recordingCount: number;
  totalDuration: number;
  color: string | null;
  description: string | null;
  isActive: boolean;
}

/**
 * キュー状態
 */
export interface QueueStatus {
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  jobs: {
    waiting: Array<{ id: string; data: unknown; timestamp: number }>;
    active: Array<{ id: string; data: unknown; progress: number; timestamp: number }>;
    recentCompleted: Array<{ id: string; data: unknown; finishedOn: number }>;
    recentFailed: Array<{ id: string; data: unknown; failedReason: string }>;
  };
}

/**
 * APIフェッチャー
 */
async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json();
}

/**
 * 統計情報を取得
 */
export async function getStats(): Promise<Stats> {
  return fetcher<Stats>('/stats');
}

/**
 * 録画一覧を取得
 */
export async function getRecordings(params?: {
  page?: number;
  limit?: number;
  status?: string;
  clientName?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<{
  recordings: Recording[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.clientName) searchParams.set('clientName', params.clientName);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const query = searchParams.toString();
  return fetcher(`/recordings${query ? `?${query}` : ''}`);
}

/**
 * 録画詳細を取得
 */
export async function getRecording(id: string): Promise<{
  recording: RecordingDetail;
  logs: ProcessLog[];
}> {
  return fetcher(`/recordings/${id}`);
}

/**
 * 録画を再処理
 */
export async function reprocessRecording(
  id: string,
  steps?: string[]
): Promise<{ success: boolean; message: string; recordingId: string }> {
  return fetcher(`/recordings/${id}/reprocess`, {
    method: 'POST',
    body: JSON.stringify({ steps }),
  });
}

/**
 * クライアント一覧を取得
 */
export async function getClients(): Promise<{ clients: Client[] }> {
  return fetcher('/clients');
}

/**
 * クライアント詳細を取得
 */
export async function getClient(name: string): Promise<{
  name: string;
  recordings: Recording[];
  stats: {
    recordingCount: number;
    totalDuration: number;
    completedCount: number;
  };
  master: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    isActive: boolean;
  } | null;
}> {
  return fetcher(`/clients/${encodeURIComponent(name)}`);
}

/**
 * キュー状態を取得
 */
export async function getQueueStatus(): Promise<QueueStatus> {
  return fetcher('/queue');
}
