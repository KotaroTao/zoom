/**
 * Circleback Webhook 型定義
 */

// Webhook ペイロードの参加者
export interface CirclebackAttendee {
  name: string;
  email: string;
}

// Webhook ペイロードのアクションアイテム
export interface CirclebackActionItemPayload {
  id: string;
  title: string;
  description?: string;
  assignee?: {
    name: string;
    email: string;
  } | null;
  status: 'PENDING' | 'COMPLETED';
}

// Circleback Webhook ペイロード
export interface CirclebackWebhookPayload {
  id: string;              // ミーティングID
  name: string;            // ミーティング名
  createdAt: string;       // ISO 8601 日時
  duration?: number;       // 秒単位
  url: string;             // Circlebackのミーティング URL
  recordingUrl?: string;   // 録画URL（24時間有効）
  tags?: string[];         // タグ配列
  icalUid?: string;        // カレンダーイベント UID
  attendees: CirclebackAttendee[];
  notes?: string;          // Markdown 形式のノート
  transcript?: string;     // 文字起こし
  actionItems: CirclebackActionItemPayload[];
}

// 処理結果
export interface CirclebackProcessResult {
  success: boolean;
  meetingId?: string;
  error?: string;
}

// 保存用のミーティングデータ
export interface CirclebackMeetingData {
  circlebackId: string;
  name: string;
  notes?: string;
  transcript?: string;
  recordingUrl?: string;
  duration?: number;
  icalUid?: string;
  tags?: string[];
  attendees: CirclebackAttendee[];
  circlebackCreatedAt: Date;
  actionItems: Array<{
    circlebackId: string;
    title: string;
    description?: string;
    status: string;
    assigneeName?: string;
    assigneeEmail?: string;
  }>;
}
