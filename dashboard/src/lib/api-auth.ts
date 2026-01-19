/**
 * API認証ヘルパー
 *
 * サーバーサイドでセッションを取得し、組織IDを検証
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * 認証済みコンテキストを取得
 * 未認証または組織未所属の場合はnullを返す
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session?.user?.organizationId) {
    return null;
  }

  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role || 'member',
  };
}

/**
 * 管理者権限をチェック
 */
export function isAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
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
  return new Response(JSON.stringify({ error: '組織に所属していません' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
