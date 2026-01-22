/**
 * 組織切り替えAPI
 *
 * ユーザーのアクティブな組織を切り替える
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: '組織IDが必要です' },
        { status: 400 }
      );
    }

    // ユーザーがこの組織のメンバーであることを確認
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'この組織のメンバーではありません' },
        { status: 403 }
      );
    }

    // セッションの更新情報を返す
    // クライアント側でsession.updateを呼び出してセッションを更新する
    return NextResponse.json({
      success: true,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
      },
      // セッション更新用のデータ
      sessionUpdate: {
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error('[ORGANIZATIONS/SWITCH] Error:', error);
    return NextResponse.json(
      { error: '組織の切り替えに失敗しました' },
      { status: 500 }
    );
  }
}
