/**
 * 録画一覧API（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, noOrganizationResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId, userOrganization, userId } = auth;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const clientName = searchParams.get('client');
    const status = searchParams.get('status');

    // 基本条件を構築
    const baseConditions: Record<string, unknown>[] = [];

    // 組織に所属している場合、その組織の録画を含める
    if (organizationId) {
      baseConditions.push({ organizationId });
    }

    // 自分が作成した録画を含める
    baseConditions.push({ createdByUserId: userId });

    // 組織タグが設定されている場合、同じ組織タグを持つユーザーの録画も含める
    if (userOrganization) {
      // 同じ組織タグを持つユーザーIDを取得
      const usersWithSameOrg = await prisma.user.findMany({
        where: {
          organization: userOrganization,
          id: { not: userId }, // 自分以外
        },
        select: { id: true },
      });

      if (usersWithSameOrg.length > 0) {
        const userIds = usersWithSameOrg.map((u: { id: string }) => u.id);
        baseConditions.push({
          createdByUserId: { in: userIds },
        });
      }
    }

    // OR条件で結合（条件がない場合は空の結果になる）
    const where: Record<string, unknown> = baseConditions.length > 0
      ? { OR: baseConditions }
      : { id: 'none' }; // 条件がない場合は結果なし

    // 追加フィルター
    if (clientName) where.clientName = clientName;
    if (status) where.status = status;

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        orderBy: { meetingDate: 'desc' },
        take: limit,
        skip: offset,
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.recording.count({ where }),
    ]);

    return NextResponse.json({
      recordings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Recordings API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}

// 録画更新
export async function PUT(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return noOrganizationResponse();
  }

  try {
    const body = await request.json();
    const { id, title, clientName } = body;

    if (!id) {
      return NextResponse.json(
        { error: '録画IDは必須です' },
        { status: 400 }
      );
    }

    // 所有権確認
    const existing = await prisma.recording.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    // clientNameがnullまたは空文字の場合はnullに設定
    const updateData: Record<string, string | null> = {};
    if (title !== undefined) {
      updateData.title = title.trim();
    }
    if (clientName !== undefined) {
      // null, 空文字, 空白のみの場合はnullに
      updateData.clientName = clientName && clientName.trim() ? clientName.trim() : null;
    }

    const recording = await prisma.recording.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, recording });
  } catch (error) {
    console.error('Update recording error:', error);
    return NextResponse.json(
      { error: '録画の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 録画削除
export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return noOrganizationResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '録画IDは必須です' },
        { status: 400 }
      );
    }

    // 所有権確認
    const existing = await prisma.recording.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    // 削除実行
    await prisma.recording.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: '録画を削除しました' });
  } catch (error) {
    console.error('Delete recording error:', error);
    return NextResponse.json(
      { error: '録画の削除に失敗しました' },
      { status: 500 }
    );
  }
}
