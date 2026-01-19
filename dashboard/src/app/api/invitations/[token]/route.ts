/**
 * 招待受け入れAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * 招待情報を取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { name: true, slug: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: '招待が見つかりません' },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: '招待の有効期限が切れています' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      invitedBy: invitation.invitedBy.name,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Invitation GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    );
  }
}

/**
 * 招待を受け入れる
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: '招待が見つかりません' },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: '招待の有効期限が切れています' },
        { status: 410 }
      );
    }

    // メールアドレスの照合（オプション - 厳密にしたい場合）
    // if (invitation.email !== session.user.email) {
    //   return NextResponse.json(
    //     { error: '招待されたメールアドレスでログインしてください' },
    //     { status: 403 }
    //   );
    // }

    // 既にメンバーかチェック
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existingMembership) {
      // 既にメンバーの場合は招待を削除して成功を返す
      await prisma.invitation.delete({ where: { id: invitation.id } });
      return NextResponse.json({
        success: true,
        message: '既にこの組織のメンバーです',
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
      });
    }

    // トランザクションでメンバーシップ作成と招待削除
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          userId: session.user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      prisma.invitation.delete({ where: { id: invitation.id } }),
    ]);

    return NextResponse.json({
      success: true,
      message: '組織に参加しました',
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
    });
  } catch (error) {
    console.error('Invitation POST error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
