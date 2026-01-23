/**
 * 組織脱退API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

type TransactionClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 組織から脱退
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: orgId } = await params;

    // メンバーシップを取得
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'この組織のメンバーではありません' }, { status: 404 });
    }

    // オーナーは脱退不可（組織を削除するか、オーナーを譲渡する必要がある）
    if (membership.role === 'owner') {
      // 他にメンバーがいるかチェック
      const otherMembers = await prisma.organizationMember.count({
        where: {
          organizationId: orgId,
          userId: { not: session.user.id },
        },
      });

      if (otherMembers > 0) {
        return NextResponse.json({
          error: 'オーナーは脱退できません。他のメンバーに管理者権限を譲渡してから脱退してください。',
        }, { status: 400 });
      }

      // 自分だけの場合は組織ごと削除
      await prisma.$transaction(async (tx: TransactionClient) => {
        // 関連する招待を削除
        await tx.invitation.deleteMany({
          where: { organizationId: orgId },
        });

        // 設定を削除
        await tx.settings.deleteMany({
          where: { organizationId: orgId },
        });

        // メンバーシップを削除
        await tx.organizationMember.deleteMany({
          where: { organizationId: orgId },
        });

        // 組織を削除
        await tx.organization.delete({
          where: { id: orgId },
        });
      });

      return NextResponse.json({
        success: true,
        message: '組織を削除しました',
      });
    }

    // メンバーシップを削除（脱退）
    await prisma.organizationMember.delete({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: '組織から脱退しました',
    });
  } catch (error) {
    console.error('[LEAVE] POST Error:', error);
    return NextResponse.json(
      { error: '脱退に失敗しました' },
      { status: 500 }
    );
  }
}
