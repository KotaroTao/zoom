/**
 * Dashboard API Client
 *
 * マルチテナント対応版
 * ダッシュボードのNext.js API Routesを使用
 */

// ダッシュボードAPIのベースパス（basePath対応）
const API_BASE = '/zoom/api';

/**
 * APIリクエスト用ヘルパー
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status} ${response.statusText}`);
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
  youtubeSuccess: boolean | null;
  sheetsSuccess: boolean | null;
  notionSuccess: boolean | null;
  sheetsError: string | null;
  notionError: string | null;
  sheetRowNumber: number | null;
  notionPageId: string | null;
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
  id?: string;
  name: string;
  description?: string | null;
  color?: string | null;
  zoomUrl?: string | null;
  isActive?: boolean;
  recordingCount: number;
  totalDuration: number;
  lastMeetingDate: string | null;
}

export interface ClientInput {
  name: string;
  description?: string;
  color?: string;
  zoomUrl?: string;
}

export interface ClientUpdateInput {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  zoomUrl?: string;
  isActive?: boolean;
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

export interface Settings {
  id: string;
  organizationId: string;
  youtubeEnabled: boolean;
  youtubePrivacy: 'private' | 'unlisted' | 'public';
  transcriptionEnabled: boolean;
  transcriptionLanguage: string;
  summaryEnabled: boolean;
  summaryStyle: 'brief' | 'detailed';
  sheetsEnabled: boolean;
  notionEnabled: boolean;
  zoomAccountId: string | null;
  zoomClientId: string | null;
  zoomClientSecret: string | null;
  zoomWebhookSecretToken: string | null;
  openaiApiKey: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleSpreadsheetId: string | null;
  notionApiKey: string | null;
  notionDatabaseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Credentials {
  zoomAccountId?: string;
  zoomClientId?: string;
  zoomClientSecret?: string;
  zoomWebhookSecretToken?: string;
  openaiApiKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleSpreadsheetId?: string;
  notionApiKey?: string;
  notionDatabaseId?: string;
}

export interface CredentialsResponse {
  success: boolean;
  message: string;
  zoomAccountId: string | null;
  zoomClientId: string | null;
  zoomClientSecret: string | null;
  zoomWebhookSecretToken: string | null;
  openaiApiKey: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleSpreadsheetId: string | null;
  notionApiKey: string | null;
  notionDatabaseId: string | null;
}

export interface TestResult {
  success: boolean;
  message: string;
  accountId?: string;
  models?: string[];
}

export interface ConnectionStatus {
  zoom: { connected: boolean; message: string; configured: boolean };
  youtube: { connected: boolean; message: string; configured: boolean };
  openai: { connected: boolean; message: string; configured: boolean };
  notion: { connected: boolean; message: string; configured: boolean };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  memberCount: number;
  recordingCount: number;
  createdAt: string;
}

export interface OrganizationsResponse {
  organizations: Organization[];
}

export interface ReportTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  content: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatesResponse {
  templates: ReportTemplate[];
}

export interface TemplateInput {
  name: string;
  description?: string;
  content: string;
  isDefault?: boolean;
}

export interface TemplateUpdateInput {
  name?: string;
  description?: string;
  content?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ReportResponse {
  report: string;
  templateId: string;
  generatedAt?: string;
}

export interface ReportGenerateResponse {
  success: boolean;
  report: string;
  templateId: string;
}

// API Functions
export const api = {
  /**
   * 統計情報を取得
   */
  getStats: () => fetchApi<Stats>('/stats'),

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
    return fetchApi<RecordingsResponse>(`/recordings${query ? `?${query}` : ''}`);
  },

  /**
   * 録画詳細を取得
   */
  getRecording: (id: string) => fetchApi<Recording>(`/recordings/${id}`),

  /**
   * 録画を更新
   */
  updateRecording: (data: { id: string; title?: string; clientName?: string | null }) =>
    fetchApi<{ success: boolean; recording: Recording }>('/recordings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * クライアント一覧を取得
   */
  getClients: () => fetchApi<ClientsResponse>('/clients'),

  /**
   * クライアントを作成
   */
  createClient: (data: ClientInput) =>
    fetchApi<{ success: boolean; client: Client }>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * クライアントを更新
   */
  updateClient: (data: ClientUpdateInput) =>
    fetchApi<{ success: boolean; client: Client }>('/clients', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * クライアントを削除
   */
  deleteClient: (id: string) =>
    fetchApi<{ success: boolean }>(`/clients?id=${id}`, {
      method: 'DELETE',
    }),

  /**
   * クライアントの録画一覧を取得
   */
  getClientRecordings: (name: string) =>
    fetchApi<ClientRecordingsResponse>(`/clients/${encodeURIComponent(name)}/recordings`),

  /**
   * キューステータスを取得
   */
  getQueueStatus: () => fetchApi<QueueStatus>('/queue'),

  /**
   * 処理ログを取得
   */
  getLogs: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return fetchApi<LogsResponse>(`/logs${query}`);
  },

  /**
   * 設定を取得
   */
  getSettings: () => fetchApi<Settings>('/settings'),

  /**
   * 設定を更新
   */
  updateSettings: (settings: Partial<Omit<Settings, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>) =>
    fetchApi<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  /**
   * API認証情報を更新
   */
  updateCredentials: (credentials: Credentials) =>
    fetchApi<CredentialsResponse>('/settings/credentials', {
      method: 'PUT',
      body: JSON.stringify(credentials),
    }),

  /**
   * 接続テスト（バックエンドAPI経由）
   */
  testZoom: () =>
    fetchApi<TestResult>('/test/zoom', { method: 'POST' }),

  testGoogle: () =>
    fetchApi<TestResult>('/test/google', { method: 'POST' }),

  testOpenAI: () =>
    fetchApi<TestResult>('/test/openai', { method: 'POST' }),

  testNotion: () =>
    fetchApi<TestResult>('/test/notion', { method: 'POST' }),

  getConnectionStatus: () =>
    fetchApi<ConnectionStatus>('/connection-status'),

  /**
   * 組織一覧を取得
   */
  getOrganizations: () => fetchApi<OrganizationsResponse>('/organizations'),

  /**
   * 組織を作成
   */
  createOrganization: (name: string) =>
    fetchApi<{ success: boolean; organization: Organization }>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // =============================================
  // テンプレート API
  // =============================================

  /**
   * テンプレート一覧を取得
   */
  getTemplates: (includeInactive = false) =>
    fetchApi<TemplatesResponse>(`/templates${includeInactive ? '?includeInactive=true' : ''}`),

  /**
   * テンプレート詳細を取得
   */
  getTemplate: (id: string) => fetchApi<ReportTemplate>(`/templates/${id}`),

  /**
   * テンプレートを作成
   */
  createTemplate: (data: TemplateInput) =>
    fetchApi<ReportTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * テンプレートを更新
   */
  updateTemplate: (id: string, data: TemplateUpdateInput) =>
    fetchApi<ReportTemplate>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * テンプレートを削除
   */
  deleteTemplate: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/templates/${id}`, {
      method: 'DELETE',
    }),

  /**
   * テンプレートをプレビュー
   */
  previewTemplate: (content: string) =>
    fetchApi<{ preview: string }>('/templates/preview', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // =============================================
  // クライアント報告書 API
  // =============================================

  /**
   * 報告書を取得
   */
  getReport: (recordingId: string) =>
    fetchApi<ReportResponse>(`/recordings/${recordingId}/report`),

  /**
   * 報告書を生成
   */
  generateReport: (recordingId: string, templateId?: string, save = false) =>
    fetchApi<ReportGenerateResponse>(`/recordings/${recordingId}/report`, {
      method: 'POST',
      body: JSON.stringify({ templateId, save }),
    }),
};
