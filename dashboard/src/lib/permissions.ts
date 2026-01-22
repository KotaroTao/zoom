/**
 * 権限管理ヘルパー
 *
 * 役割と権限の定義
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

// 役割の優先順位（数値が大きいほど上位）
export const ROLE_PRIORITY: Record<Role, number> = {
  owner: 100,
  admin: 75,
  member: 50,
  viewer: 25,
};

// 権限の種類
export const PERMISSIONS = {
  // 録画関連
  RECORDING_VIEW: 'recording:view',
  RECORDING_RETRY: 'recording:retry',
  RECORDING_DELETE: 'recording:delete',

  // クライアント関連
  CLIENT_VIEW: 'client:view',
  CLIENT_EDIT: 'client:edit',
  CLIENT_DELETE: 'client:delete',

  // 設定関連
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  CREDENTIALS_EDIT: 'credentials:edit',

  // メンバー管理
  MEMBER_VIEW: 'member:view',
  MEMBER_INVITE: 'member:invite',
  MEMBER_EDIT: 'member:edit',
  MEMBER_REMOVE: 'member:remove',

  // 組織管理
  ORGANIZATION_EDIT: 'organization:edit',
  ORGANIZATION_DELETE: 'organization:delete',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// 役割ごとの権限マッピング
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    // 全権限
    PERMISSIONS.RECORDING_VIEW,
    PERMISSIONS.RECORDING_RETRY,
    PERMISSIONS.RECORDING_DELETE,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.CLIENT_EDIT,
    PERMISSIONS.CLIENT_DELETE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.CREDENTIALS_EDIT,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_EDIT,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.ORGANIZATION_EDIT,
    PERMISSIONS.ORGANIZATION_DELETE,
  ],
  admin: [
    PERMISSIONS.RECORDING_VIEW,
    PERMISSIONS.RECORDING_RETRY,
    PERMISSIONS.RECORDING_DELETE,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.CLIENT_EDIT,
    PERMISSIONS.CLIENT_DELETE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.CREDENTIALS_EDIT,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_EDIT,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.ORGANIZATION_EDIT,
  ],
  member: [
    PERMISSIONS.RECORDING_VIEW,
    PERMISSIONS.RECORDING_RETRY,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.CLIENT_EDIT,
    PERMISSIONS.MEMBER_VIEW,
  ],
  viewer: [
    PERMISSIONS.RECORDING_VIEW,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.MEMBER_VIEW,
  ],
};

/**
 * 指定された役割が特定の権限を持っているかチェック
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * 指定された役割の全権限を取得
 */
export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] || [];
}

/**
 * オーナーかどうか
 */
export function isOwner(role: string): boolean {
  return role === ROLES.OWNER;
}

/**
 * 管理者以上かどうか（オーナーまたは管理者）
 */
export function isAdmin(role: string): boolean {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

/**
 * メンバー以上かどうか（閲覧者以外）
 */
export function isMember(role: string): boolean {
  return role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.MEMBER;
}

/**
 * 対象の役割を変更する権限があるかチェック
 * （自分より下位の役割のみ変更可能）
 */
export function canModifyRole(myRole: string, targetRole: string): boolean {
  const myPriority = ROLE_PRIORITY[myRole as Role] || 0;
  const targetPriority = ROLE_PRIORITY[targetRole as Role] || 0;
  return myPriority > targetPriority;
}

/**
 * 割り当て可能な役割の一覧を取得
 * （自分より下位の役割のみ）
 */
export function getAssignableRoles(myRole: string): Role[] {
  const myPriority = ROLE_PRIORITY[myRole as Role] || 0;
  return (Object.entries(ROLE_PRIORITY) as [Role, number][])
    .filter(([, priority]) => priority < myPriority)
    .map(([role]) => role);
}

/**
 * 役割の日本語名を取得
 */
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as Role] || role;
}

/**
 * 役割の説明を取得
 */
export function getRoleDescription(role: string): string {
  return ROLE_DESCRIPTIONS[role as Role] || '';
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
