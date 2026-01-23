/**
 * 個別招待管理API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string; invitationId: string }>;
}

/**
 * 招待をキャンセル
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: orgId, invitationId } = await params;

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

    // 招待を削除
    await prisma.invitation.delete({
      where: {
        id: invitationId,
        organizationId: orgId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[INVITATION] DELETE Error:', error);
    return NextResponse.json(
      { error: '招待のキャンセルに失敗しました' },
      { status: 500 }
    );
  }
}
