/**
 * Backend API Client
 */

// 本番環境では /zoom/api、開発環境では http://localhost:3000
const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined' && window.location.pathname.startsWith('/zoom')
    ? '/zoom/api'
    : 'http://localhost:3000'
);

/**
 * APIリクエスト用ヘルパー
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Types
export interface Stats {
  totalRecordings: number;
  totalClients: number;
  totalDuration: number;
  completedCount: number;
  weeklyRecordings: number;
  completionRate: number;
}

export interface Recording {
  id: string;
  zoomMeetingId: string;
  title: string;
  clientName: string | null;
  meetingDate: string;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  zoomUrl: string | null;
  status: string;
  duration: number | null;
  hostEmail: string | null;
  transcript: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingsResponse {
  recordings: Recording[];
  total: number;
  limit: number;
  offset: number;
}

export interface Client {
  name: string;
  recordingCount: number;
  totalDuration: number;
  lastMeetingDate: string | null;
}

export interface ClientsResponse {
  clients: Client[];
}

export interface ClientRecordingsResponse {
  clientName: string;
  recordings: Recording[];
  stats: {
    totalRecordings: number;
    totalDuration: number;
  };
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface ProcessLog {
  id: string;
  recordingId: string;
  step: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export interface LogsResponse {
  logs: ProcessLog[];
}

// API Functions
export const api = {
  /**
   * 統計情報を取得
   */
  getStats: () => fetchApi<Stats>('/api/stats'),

  /**
   * 録画一覧を取得
   */
  getRecordings: (params?: {
    limit?: number;
    offset?: number;
    client?: string;
    status?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.client) searchParams.set('client', params.client);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return fetchApi<RecordingsResponse>(`/api/recordings${query ? `?${query}` : ''}`);
  },

  /**
   * 録画詳細を取得
   */
  getRecording: (id: string) => fetchApi<Recording>(`/api/recordings/${id}`),

  /**
   * クライアント一覧を取得
   */
  getClients: () => fetchApi<ClientsResponse>('/api/clients'),

  /**
   * クライアントの録画一覧を取得
   */
  getClientRecordings: (name: string) =>
    fetchApi<ClientRecordingsResponse>(`/api/clients/${encodeURIComponent(name)}/recordings`),

  /**
   * キューステータスを取得
   */
  getQueueStatus: () => fetchApi<QueueStatus>('/api/queue'),

  /**
   * 処理ログを取得
   */
  getLogs: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return fetchApi<LogsResponse>(`/api/logs${query}`);
  },
};
