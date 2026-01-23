/**
 * 録画一覧API（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId, userId, role } = auth;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const clientName = searchParams.get('client');
    const status = searchParams.get('status');
    const teamId = searchParams.get('teamId');

    const where: Record<string, unknown> = { organizationId };
    if (clientName) where.clientName = clientName;
    if (status) where.status = status;

    // チームフィルタ
    if (teamId) {
      // 特定のチームを指定
      where.teamId = teamId;
    } else if (role !== 'owner' && role !== 'admin') {
      // 組織の管理者以外は、所属チームの録画のみ表示
      const userTeams = await prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
      });
      const teamIds = userTeams.map((t: { teamId: string }) => t.teamId);

      // 自分が所属するチームの録画、またはチームなしの録画
      where.OR = [
        { teamId: { in: teamIds } },
        { teamId: null },
      ];
    }

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        orderBy: { meetingDate: 'desc' },
        take: limit,
        skip: offset,
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

  try {
    const { organizationId } = auth;
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

  try {
    const { organizationId } = auth;
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
