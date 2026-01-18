/**
 * ミーティングタイトルからクライアント名を抽出するユーティリティ
 *
 * 対応フォーマット:
 * - 【クライアント名】ミーティング内容
 * - [クライアント名] ミーティング内容
 * - 《クライアント名》ミーティング内容
 */

// クライアント名抽出の正規表現パターン
const CLIENT_PATTERNS = [
  /【(.+?)】/,      // 【ABC商事】
  /\[(.+?)\]/,      // [ABC商事]
  /《(.+?)》/,      // 《ABC商事》
  /「(.+?)」/,      // 「ABC商事」
];

/**
 * タイトルからクライアント名を抽出
 * @param title ミーティングタイトル
 * @returns クライアント名（見つからない場合はnull）
 */
export function extractClientName(title: string): string | null {
  if (!title || typeof title !== 'string') {
    return null;
  }

  for (const pattern of CLIENT_PATTERNS) {
    const match = title.match(pattern);
    if (match && match[1]) {
      // 前後の空白を除去して返す
      return match[1].trim();
    }
  }

  return null;
}

/**
 * タイトルからクライアント名部分を除去
 * @param title ミーティングタイトル
 * @returns クライアント名を除去したタイトル
 */
export function removeClientPrefix(title: string): string {
  if (!title || typeof title !== 'string') {
    return title;
  }

  let result = title;

  for (const pattern of CLIENT_PATTERNS) {
    result = result.replace(pattern, '').trim();
  }

  return result;
}

/**
 * クライアント名付きのタイトルを生成
 * @param clientName クライアント名
 * @param meetingTitle ミーティング内容
 * @returns フォーマット済みタイトル
 */
export function formatTitleWithClient(clientName: string, meetingTitle: string): string {
  if (!clientName) {
    return meetingTitle;
  }
  return `【${clientName}】${meetingTitle}`;
}

/**
 * タイトルを解析してクライアント名とミーティング内容を分離
 * @param title ミーティングタイトル
 * @returns パース結果
 */
export function parseTitle(title: string): {
  clientName: string | null;
  meetingTitle: string;
  originalTitle: string;
} {
  const clientName = extractClientName(title);
  const meetingTitle = removeClientPrefix(title);

  return {
    clientName,
    meetingTitle,
    originalTitle: title,
  };
}

/**
 * クライアント名のバリデーション
 * @param name クライアント名
 * @returns 有効かどうか
 */
export function isValidClientName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // 空白のみは無効
  if (name.trim().length === 0) {
    return false;
  }

  // 長すぎる名前は無効（50文字まで）
  if (name.length > 50) {
    return false;
  }

  return true;
}
