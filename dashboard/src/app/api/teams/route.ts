/**
 * チーム管理API
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, isAdmin } from '@/lib/api-auth';

/**
 * チーム一覧を取得（自分が所属する組織のチーム）
 */
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId, userId } = auth;

    // 組織内の全チームを取得
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            members: true,
            recordings: true,
          },
        },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });

    const formattedTeams = teams.map((team: {
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      isDefault: boolean;
      createdAt: Date;
      _count: { members: number; recordings: number };
      members: { role: string }[];
    }) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      color: team.color,
      isDefault: team.isDefault,
      memberCount: team._count.members,
      recordingCount: team._count.recordings,
      myRole: team.members[0]?.role || null, // 自分の役割（所属していない場合はnull）
      createdAt: team.createdAt,
    }));

    return NextResponse.json({ teams: formattedTeams });
  } catch (error) {
    console.error('[TEAMS] GET Error:', error);
    return NextResponse.json(
      { error: 'チーム一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 新しいチームを作成
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 管理者権限チェック
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: 'チームの作成には管理者権限が必要です' },
      { status: 403 }
    );
  }

  try {
    const { organizationId, userId } = auth;
    const body = await request.json();
    const { name, description, color } = body;

    // バリデーション
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'チーム名は必須です' },
        { status: 400 }
      );
    }

    // 重複チェック
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

    type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

    // チーム作成（トランザクション）
    const team = await prisma.$transaction(async (tx: TxClient) => {
      // チームを作成
      const newTeam = await tx.team.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          color: color || '#3B82F6',
          organizationId,
        },
      });

      // 作成者を管理者として追加
      await tx.teamMember.create({
        data: {
          userId,
          teamId: newTeam.id,
          role: 'admin',
        },
      });

      return newTeam;
    });

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
      },
    });
  } catch (error) {
    console.error('[TEAMS] POST Error:', error);
    return NextResponse.json(
      { error: 'チームの作成に失敗しました' },
      { status: 500 }
    );
  }
}
