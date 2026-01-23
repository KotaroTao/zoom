/**
 * チーム個別操作API
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, isAdmin } from '@/lib/api-auth';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * チーム詳細を取得
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const { organizationId, userId } = auth;

    const team = await prisma.team.findFirst({
      where: {
        id,
        organizationId, // 自分の組織のチームのみ
      },
      include: {
        members: {
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
        },
        _count: {
          select: {
            recordings: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    type TeamMember = {
      id: string;
      userId: string;
      role: string;
      createdAt: Date;
      user: { id: string; email: string; name: string | null; image: string | null };
    };

    const myMembership = team.members.find((m: TeamMember) => m.userId === userId);

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        isDefault: team.isDefault,
        recordingCount: team._count.recordings,
        myRole: myMembership?.role || null,
        createdAt: team.createdAt,
        members: team.members.map((m: TeamMember) => ({
          id: m.id,
          userId: m.user.id,
          email: m.user.email,
          name: m.user.name,
          image: m.user.image,
          role: m.role,
          joinedAt: m.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('[TEAM] GET Error:', error);
    return NextResponse.json(
      { error: 'チーム情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * チームを更新
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const { organizationId, userId } = auth;

    // チームを取得して権限確認
    const team = await prisma.team.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    // 組織管理者またはチーム管理者のみ編集可能
    const isOrgAdmin = isAdmin(auth.role);
    const isTeamAdmin = team.members[0]?.role === 'admin';

    if (!isOrgAdmin && !isTeamAdmin) {
      return NextResponse.json(
        { error: 'チームの編集には管理者権限が必要です' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, color } = body;

    // 名前変更時は重複チェック
    if (name && name.trim() !== team.name) {
      const existingTeam = await prisma.team.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: name.trim(),
          },
        },
      });

      if (existingTeam) {
        return NextResponse.json(
          { error: '同じ名前のチームが既に存在します' },
          { status: 400 }
        );
      }
    }

    const updatedTeam = await prisma.team.update({
      where: { id },
      data: {
        name: name?.trim() || team.name,
        description: description !== undefined ? description?.trim() || null : team.description,
        color: color || team.color,
      },
    });

    return NextResponse.json({
      success: true,
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        color: updatedTeam.color,
      },
    });
  } catch (error) {
    console.error('[TEAM] PATCH Error:', error);
    return NextResponse.json(
      { error: 'チームの更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * チームを削除
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 組織管理者のみ削除可能
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: 'チームの削除には組織管理者権限が必要です' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const { organizationId } = auth;

    const team = await prisma.team.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    // デフォルトチームは削除不可
    if (team.isDefault) {
      return NextResponse.json(
        { error: 'デフォルトチームは削除できません' },
        { status: 400 }
      );
    }

    // 録画をデフォルトチームに移動してから削除
    const defaultTeam = await prisma.team.findFirst({
      where: {
        organizationId,
        isDefault: true,
      },
    });

    type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

    await prisma.$transaction(async (tx: TxClient) => {
      // 録画をデフォルトチームに移動
      if (defaultTeam) {
        await tx.recording.updateMany({
          where: { teamId: id },
          data: { teamId: defaultTeam.id },
        });
      }

      // チームを削除（メンバーシップはCascadeで自動削除）
      await tx.team.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TEAM] DELETE Error:', error);
    return NextResponse.json(
      { error: 'チームの削除に失敗しました' },
      { status: 500 }
    );
  }
}
