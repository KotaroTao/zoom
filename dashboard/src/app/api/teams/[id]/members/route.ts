/**
 * チームメンバー管理API
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, isAdmin } from '@/lib/api-auth';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * チームの管理者かどうかをチェック
 */
async function isTeamAdmin(teamId: string, userId: string): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
  return membership?.role === 'admin';
}

/**
 * チームメンバー一覧を取得
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id: teamId } = await params;
    const { organizationId } = auth;

    // チームが自分の組織に属しているか確認
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // admin -> member -> viewer
        { createdAt: 'asc' },
      ],
    });

    type MemberWithUser = {
      id: string;
      role: string;
      createdAt: Date;
      user: { id: string; email: string; name: string | null; image: string | null };
    };

    const formattedMembers = members.map((m: MemberWithUser) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      image: m.user.image,
      role: m.role,
      joinedAt: m.createdAt,
    }));

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error('[TEAM MEMBERS] GET Error:', error);
    return NextResponse.json(
      { error: 'メンバー一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * チームにメンバーを追加
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id: teamId } = await params;
    const { organizationId, userId } = auth;

    // チームが自分の組織に属しているか確認
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    // 組織管理者またはチーム管理者のみ追加可能
    const orgAdmin = isAdmin(auth.role);
    const teamAdmin = await isTeamAdmin(teamId, userId);

    if (!orgAdmin && !teamAdmin) {
      return NextResponse.json(
        { error: 'メンバーの追加には管理者権限が必要です' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userIds, role = 'member' } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'ユーザーIDを指定してください' },
        { status: 400 }
      );
    }

    // 役割のバリデーション
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: '無効な役割です' },
        { status: 400 }
      );
    }

    // 追加対象ユーザーが組織に所属しているか確認
    const orgMembers = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        userId: { in: userIds },
      },
    });

    const validUserIds = orgMembers.map((m: { userId: string }) => m.userId);

    if (validUserIds.length === 0) {
      return NextResponse.json(
        { error: '指定されたユーザーは組織に所属していません' },
        { status: 400 }
      );
    }

    // 既存メンバーを除外
    const existingMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        userId: { in: validUserIds },
      },
    });
    const existingUserIds = new Set(existingMembers.map((m: { userId: string }) => m.userId));
    const newUserIds = validUserIds.filter((id: string) => !existingUserIds.has(id));

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: '指定されたユーザーは既にチームメンバーです' },
        { status: 400 }
      );
    }

    // メンバーを追加
    await prisma.teamMember.createMany({
      data: newUserIds.map((uid: string) => ({
        userId: uid,
        teamId,
        role,
      })),
    });

    return NextResponse.json({
      success: true,
      addedCount: newUserIds.length,
    });
  } catch (error) {
    console.error('[TEAM MEMBERS] POST Error:', error);
    return NextResponse.json(
      { error: 'メンバーの追加に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * メンバーの役割を変更
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id: teamId } = await params;
    const { organizationId, userId } = auth;

    // チームが自分の組織に属しているか確認
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    // 組織管理者またはチーム管理者のみ変更可能
    const orgAdmin = isAdmin(auth.role);
    const teamAdmin = await isTeamAdmin(teamId, userId);

    if (!orgAdmin && !teamAdmin) {
      return NextResponse.json(
        { error: '役割の変更には管理者権限が必要です' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json(
        { error: 'メンバーIDと役割を指定してください' },
        { status: 400 }
      );
    }

    // 役割のバリデーション
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: '無効な役割です' },
        { status: 400 }
      );
    }

    // 対象メンバーを取得
    const targetMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 自分自身の役割は変更不可（別の管理者が必要）
    if (targetMember.userId === userId && !orgAdmin) {
      return NextResponse.json(
        { error: '自分自身の役割は変更できません' },
        { status: 400 }
      );
    }

    await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TEAM MEMBERS] PATCH Error:', error);
    return NextResponse.json(
      { error: '役割の変更に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * メンバーをチームから削除
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id: teamId } = await params;
    const { organizationId, userId } = auth;

    // チームが自分の組織に属しているか確認
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    // 組織管理者またはチーム管理者のみ削除可能
    const orgAdmin = isAdmin(auth.role);
    const teamAdmin = await isTeamAdmin(teamId, userId);

    if (!orgAdmin && !teamAdmin) {
      return NextResponse.json(
        { error: 'メンバーの削除には管理者権限が必要です' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { error: 'メンバーIDを指定してください' },
        { status: 400 }
      );
    }

    // 対象メンバーを取得
    const targetMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 最後の管理者は削除不可
    if (targetMember.role === 'admin') {
      const adminCount = await prisma.teamMember.count({
        where: {
          teamId,
          role: 'admin',
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: '最後の管理者は削除できません' },
          { status: 400 }
        );
      }
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TEAM MEMBERS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'メンバーの削除に失敗しました' },
      { status: 500 }
    );
  }
}
