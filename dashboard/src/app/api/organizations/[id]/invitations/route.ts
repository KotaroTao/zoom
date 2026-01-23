/**
 * 組織招待API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { randomBytes } from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 招待一覧を取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: orgId } = await params;

    // 権限チェック
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // 有効な招待を取得
    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: orgId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('[INVITATIONS] GET Error:', error);
    return NextResponse.json(
      { error: '招待一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 新しい招待を作成
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: orgId } = await params;
    const body = await request.json();
    const { email, role = 'member' } = body;

    // バリデーション
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: '無効な役割です' }, { status: 400 });
    }

    // 権限チェック
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // 既にメンバーかチェック
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: orgId,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json({ error: 'このユーザーは既にメンバーです' }, { status: 400 });
      }
    }

    // 既存の招待をチェック
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId: orgId,
        email: email.toLowerCase(),
        status: 'pending',
      },
    });

    if (existingInvitation) {
      return NextResponse.json({ error: 'このメールアドレスには既に招待が送られています' }, { status: 400 });
    }

    // 招待トークンを生成
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7日後に期限切れ

    // 招待を作成
    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        token,
        role,
        organizationId: orgId,
        invitedById: session.user.id,
        expiresAt,
      },
    });

    // 招待リンクを生成
    const baseUrl = process.env.NEXTAUTH_URL || 'https://tao-dx.com/zoom';
    const inviteLink = `${baseUrl}/invite/${token}`;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      inviteLink,
    });
  } catch (error) {
    console.error('[INVITATIONS] POST Error:', error);
    return NextResponse.json(
      { error: '招待の作成に失敗しました' },
      { status: 500 }
    );
  }
}
