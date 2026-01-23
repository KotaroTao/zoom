/**
 * メンバー管理API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

/**
 * メンバーの役割を変更
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: orgId, memberId } = await params;
    const body = await request.json();
    const { role } = body;

    // バリデーション
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: '無効な役割です' }, { status: 400 });
    }

    // 権限チェック（owner または admin のみ変更可能）
    const myMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // 対象メンバーを取得
    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.organizationId !== orgId) {
      return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 });
    }

    // オーナーの役割は変更不可
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'オーナーの役割は変更できません' }, { status: 400 });
    }

    // 役割を更新
    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });

    return NextResponse.json({
      success: true,
      member: updated,
    });
  } catch (error) {
    console.error('[MEMBER] PUT Error:', error);
    return NextResponse.json(
      { error: '役割の変更に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * メンバーを削除
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: orgId, memberId } = await params;

    // 権限チェック
    const myMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // 対象メンバーを取得
    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.organizationId !== orgId) {
      return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 });
    }

    // オーナーは削除不可
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'オーナーは削除できません' }, { status: 400 });
    }

    // 自分自身は削除不可（脱退APIを使用）
    if (targetMember.userId === session.user.id) {
      return NextResponse.json({ error: '自分自身を削除するには脱退機能を使用してください' }, { status: 400 });
    }

    // メンバーを削除
    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MEMBER] DELETE Error:', error);
    return NextResponse.json(
      { error: 'メンバーの削除に失敗しました' },
      { status: 500 }
    );
  }
}
