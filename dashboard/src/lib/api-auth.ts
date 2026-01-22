/**
 * API認証ヘルパー
 *
 * サーバーサイドでセッションを取得し、組織IDを検証
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './db';
import {
  hasPermission,
  isAdmin as checkIsAdmin,
  isOwner as checkIsOwner,
  isMember as checkIsMember,
  canModifyRole,
  getRoleLabel,
  type Permission,
} from './permissions';

// permissions.tsから再エクスポート
export {
  ROLES,
  PERMISSIONS,
  hasPermission,
  canModifyRole,
  getAssignableRoles,
  getRoleLabel,
  getRoleDescription,
  getAllRoles,
  type Role,
  type Permission,
} from './permissions';

export interface AuthContext {
  userId: string;
  organizationId: string | null;  // nullは組織未所属を意味する
  role: string;
}

/**
 * 認証済みコンテキストを取得
 * 未認証の場合はnullを返す
 * 組織未所属の場合はorganizationId=nullのAuthContextを返す
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  // セッションに組織情報がある場合はそのまま使用
  if (session.user.organizationId) {
    return {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role || 'member',
    };
  }

  // セッションに組織情報がない場合、DBから取得を試みる
  try {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (membership) {
      return {
        userId: session.user.id,
        organizationId: membership.organizationId,
        role: membership.role,
      };
    }
  } catch (error) {
    console.error('[API-AUTH] Failed to fetch membership from DB:', error);
  }

  // 組織未所属でも認証コンテキストを返す
  return {
    userId: session.user.id,
    organizationId: null,
    role: 'member',
  };
}

/**
 * オーナーかどうか
 */
export function isOwner(role: string): boolean {
  return checkIsOwner(role);
}

/**
 * 管理者以上かどうか（オーナーまたは管理者）
 */
export function isAdmin(role: string): boolean {
  return checkIsAdmin(role);
}

/**
 * メンバー以上かどうか（閲覧者以外）
 */
export function isMember(role: string): boolean {
  return checkIsMember(role);
}

/**
 * 特定の権限を持っているかチェック
 */
export function checkPermission(role: string, permission: Permission): boolean {
  return hasPermission(role, permission);
}

/**
 * 未認証レスポンスを返す
 */
export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: '認証が必要です' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 組織未所属レスポンスを返す
 */
export function noOrganizationResponse() {
  return new Response(JSON.stringify({ error: '組織に所属していません', noOrganization: true }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 権限不足レスポンスを返す
 */
export function forbiddenResponse(message?: string) {
  return new Response(
    JSON.stringify({ error: message || '権限がありません' }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
