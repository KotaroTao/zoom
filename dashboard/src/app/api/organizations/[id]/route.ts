/**
 * 組織個別操作API（編集・削除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions, generateSlug } from '@/lib/auth';

/**
 * 組織の詳細を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = params;

    // メンバーシップを確認
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'この組織にアクセスする権限がありません' },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            teams: true,
            recordings: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: '組織が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        ...organization,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error('[ORGANIZATION] GET Error:', error);
    return NextResponse.json(
      { error: '組織の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 組織を更新（名前変更など）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = params;

    // メンバーシップと権限を確認（owner または admin のみ編集可能）
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: id,
        },
      },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: '組織を編集する権限がありません' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: '組織名は必須です' },
        { status: 400 }
      );
    }

    // スラッグを再生成
    let slug = generateSlug(name);

    // スラッグの重複チェック（自分以外）
    const existingOrg = await prisma.organization.findFirst({
      where: {
        slug,
        id: { not: id },
      },
    });

    if (existingOrg) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        name: name.trim(),
        slug,
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (error) {
    console.error('[ORGANIZATION] PUT Error:', error);
    return NextResponse.json(
      { error: '組織の更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 組織を削除（オーナーのみ）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = params;

    // メンバーシップと権限を確認（owner のみ削除可能）
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: id,
        },
      },
    });

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: '組織を削除する権限がありません（オーナーのみ可能）' },
        { status: 403 }
      );
    }

    // 組織を削除（関連データはCascadeで削除される）
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '組織を削除しました',
    });
  } catch (error) {
    console.error('[ORGANIZATION] DELETE Error:', error);
    return NextResponse.json(
      { error: '組織の削除に失敗しました' },
      { status: 500 }
    );
  }
}
