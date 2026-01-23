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
  role: string; // 組織での役割: owner, admin, member
  isPersonalMode?: boolean;
}

export interface TeamAuthContext extends AuthContext {
  teamId: string;
  teamRole: string; // チームでの役割: admin, member, viewer
}

// 組織の役割定義
export const OrgRoles = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

// チームの役割定義
export const TeamRoles = {
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

// 権限マトリクス
export const Permissions = {
  // 組織レベル
  ORG_SETTINGS: [OrgRoles.OWNER, OrgRoles.ADMIN],
  ORG_MEMBERS: [OrgRoles.OWNER, OrgRoles.ADMIN],
  ORG_TEAMS: [OrgRoles.OWNER, OrgRoles.ADMIN],
  ORG_BILLING: [OrgRoles.OWNER],
  ORG_DELETE: [OrgRoles.OWNER],

  // チームレベル
  TEAM_SETTINGS: [TeamRoles.ADMIN],
  TEAM_MEMBERS: [TeamRoles.ADMIN],
  RECORDING_MANAGE: [TeamRoles.ADMIN, TeamRoles.MEMBER],
  RECORDING_VIEW: [TeamRoles.ADMIN, TeamRoles.MEMBER, TeamRoles.VIEWER],
  CLIENT_MANAGE: [TeamRoles.ADMIN],
} as const;

/**
 * 認証済みコンテキストを取得
 * 未認証または組織未所属の場合はnullを返す
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

/**
 * 権限不足レスポンスを返す
 */
export function forbiddenResponse(message = '権限がありません') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * チームの認証コンテキストを取得
 */
export async function getTeamAuthContext(teamId: string): Promise<TeamAuthContext | null> {
  const auth = await getAuthContext();
  if (!auth) {
    return null;
  }

  // チームが自分の組織に属しているか確認
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      organizationId: auth.organizationId,
    },
  });

  if (!team) {
    return null;
  }

  // チームでの自分の役割を取得
  const teamMembership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId: auth.userId,
        teamId,
      },
    },
  });

  return {
    ...auth,
    teamId,
    teamRole: teamMembership?.role || 'viewer', // 組織メンバーはデフォルトでviewer
  };
}

/**
 * 組織レベルの権限をチェック
 */
export function hasOrgPermission(
  role: string,
  permission: keyof typeof Permissions
): boolean {
  const allowedRoles = Permissions[permission] as readonly string[];
  return allowedRoles.includes(role);
}

/**
 * チームレベルの権限をチェック
 */
export function hasTeamPermission(
  teamRole: string,
  permission: keyof typeof Permissions
): boolean {
  const allowedRoles = Permissions[permission] as readonly string[];
  return allowedRoles.includes(teamRole);
}

/**
 * 録画の閲覧権限をチェック
 * - 組織の管理者は全ての録画を閲覧可能
 * - チームメンバーは所属チームの録画を閲覧可能
 */
export async function canViewRecording(
  userId: string,
  organizationId: string,
  recordingTeamId: string | null
): Promise<boolean> {
  // 組織での役割を取得
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!orgMembership) {
    return false;
  }

  // 組織の管理者は全て閲覧可能
  if (isAdmin(orgMembership.role)) {
    return true;
  }

  // チームに紐づいていない録画は組織メンバー全員が閲覧可能
  if (!recordingTeamId) {
    return true;
  }

  // チームメンバーかどうかを確認
  const teamMembership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId: recordingTeamId,
      },
    },
  });

  return !!teamMembership;
}

/**
 * 録画の編集権限をチェック
 */
export async function canEditRecording(
  userId: string,
  organizationId: string,
  recordingTeamId: string | null
): Promise<boolean> {
  // 組織での役割を取得
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!orgMembership) {
    return false;
  }

  // 組織の管理者は全て編集可能
  if (isAdmin(orgMembership.role)) {
    return true;
  }

  // チームに紐づいていない録画は組織メンバーが編集可能
  if (!recordingTeamId) {
    return true;
  }

  // チームでの役割を確認
  const teamMembership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId: recordingTeamId,
      },
    },
  });

  // admin または member は編集可能
  return teamMembership?.role === 'admin' || teamMembership?.role === 'member';
}
