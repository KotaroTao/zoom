/**
 * 組織招待API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, isAdmin } from '@/lib/api-auth';
import { generateInviteToken } from '@/lib/auth';

/**
 * 招待一覧を取得
 */
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 管理者権限をチェック
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: '招待一覧を閲覧する権限がありません' },
      { status: 403 }
    );
  }

  try {
    const { organizationId } = auth;

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId,
        expiresAt: { gt: new Date() }, // 期限切れを除外
      },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Invitations GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

/**
 * 招待を作成
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 管理者権限をチェック
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: 'メンバーを招待する権限がありません' },
      { status: 403 }
    );
  }

  try {
    const { organizationId, userId } = auth;
    const body = await request.json();
    const { email, role = 'member' } = body;

    // バリデーション
    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスは必須です' },
        { status: 400 }
      );
    }

    // 既にメンバーかチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organizationId },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { error: 'このユーザーは既に組織のメンバーです' },
        { status: 400 }
      );
    }

    // 既に招待済みかチェック
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'このメールアドレスには既に招待を送信済みです' },
        { status: 400 }
      );
    }

    // 組織のメンバー数制限をチェック
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (organization && organization._count.members >= organization.maxMembers) {
      return NextResponse.json(
        { error: `メンバー数の上限（${organization.maxMembers}人）に達しています` },
        { status: 400 }
      );
    }

    // 招待を作成
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7日間有効

    const invitation = await prisma.invitation.create({
      data: {
        email,
        orgRole: role,
        token,
        expiresAt,
        invitedById: userId,
        organizationId,
      },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    // 招待URLを生成
    const inviteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/invite/${token}`;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.orgRole,
        expiresAt: invitation.expiresAt,
        inviteUrl,
        organizationName: invitation.organization.name,
      },
    });
  } catch (error) {
    console.error('Invitation POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}
