/**
 * API認証ヘルパー
 *
 * サーバーサイドでセッションを取得し、組織IDを検証
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './db';

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: string;
  userOrganization?: string | null;  // ユーザーの組織タグ（共有用）
}

/**
 * 認証済みコンテキストを取得
 * 未認証または組織未所属の場合はnullを返す
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  // ユーザーの組織タグを取得
  let userOrganization: string | null = null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organization: true },
    });
    userOrganization = user?.organization || null;
  } catch (error) {
    console.error('[API-AUTH] Failed to fetch user organization:', error);
  }

  // セッションに組織情報がある場合はそのまま使用
  if (session.user.organizationId) {
    return {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role || 'member',
      userOrganization,
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
        userOrganization,
      };
    }
  } catch (error) {
    console.error('[API-AUTH] Failed to fetch membership from DB:', error);
  }

  return null;
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
