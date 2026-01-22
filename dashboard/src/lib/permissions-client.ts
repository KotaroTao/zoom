/**
 * クライアントサイド用権限ヘルパー
 *
 * UIでの権限チェックと表示に使用
 */

// 役割の定義
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// 役割の日本語名
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'オーナー',
  admin: '管理者',
  member: 'メンバー',
  viewer: '閲覧者',
};

// 役割の説明
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: '全権限を持ち、組織の削除も可能',
  admin: '設定変更、メンバー招待が可能',
  member: '録画の閲覧・管理が可能',
  viewer: '録画の閲覧のみ可能',
};

// 役割のバッジカラー
export const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  owner: { bg: 'bg-purple-100', text: 'text-purple-800' },
  admin: { bg: 'bg-blue-100', text: 'text-blue-800' },
  member: { bg: 'bg-green-100', text: 'text-green-800' },
  viewer: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

/**
 * オーナーかどうか
 */
export function isOwner(role: string | undefined): boolean {
  return role === ROLES.OWNER;
}

/**
 * 管理者以上かどうか（オーナーまたは管理者）
 */
export function isAdmin(role: string | undefined): boolean {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

/**
 * メンバー以上かどうか（閲覧者以外）
 */
export function isMember(role: string | undefined): boolean {
  return role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.MEMBER;
}

/**
 * 役割の日本語名を取得
 */
export function getRoleLabel(role: string | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role as Role] || role;
}

/**
 * 役割の説明を取得
 */
export function getRoleDescription(role: string | undefined): string {
  if (!role) return '';
  return ROLE_DESCRIPTIONS[role as Role] || '';
}

/**
 * 役割のバッジカラーを取得
 */
export function getRoleColor(role: string | undefined): { bg: string; text: string } {
  if (!role) return { bg: 'bg-gray-100', text: 'text-gray-800' };
  return ROLE_COLORS[role as Role] || { bg: 'bg-gray-100', text: 'text-gray-800' };
}

/**
 * 全役割の一覧を取得（選択肢用）
 */
export function getAllRoles(): { value: Role; label: string; description: string }[] {
  return [
    { value: ROLES.OWNER, label: ROLE_LABELS.owner, description: ROLE_DESCRIPTIONS.owner },
    { value: ROLES.ADMIN, label: ROLE_LABELS.admin, description: ROLE_DESCRIPTIONS.admin },
    { value: ROLES.MEMBER, label: ROLE_LABELS.member, description: ROLE_DESCRIPTIONS.member },
    { value: ROLES.VIEWER, label: ROLE_LABELS.viewer, description: ROLE_DESCRIPTIONS.viewer },
  ];
}

// 機能ごとの権限チェック
export const permissions = {
  // 設定閲覧
  canViewSettings: (role: string | undefined) => isAdmin(role),

  // 設定変更
  canEditSettings: (role: string | undefined) => isAdmin(role),

  // メンバー招待
  canInviteMembers: (role: string | undefined) => isAdmin(role),

  // メンバー編集（役割変更・削除）
  canEditMembers: (role: string | undefined) => isAdmin(role),

  // 録画削除
  canDeleteRecordings: (role: string | undefined) => isAdmin(role),

  // 録画リトライ
  canRetryRecordings: (role: string | undefined) => isMember(role),

  // クライアント編集
  canEditClients: (role: string | undefined) => isMember(role),

  // 組織削除
  canDeleteOrganization: (role: string | undefined) => isOwner(role),
};
