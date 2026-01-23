/**
 * 組織メンバー個別操作API（権限変更・チーム管理・削除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, isAdmin } from '@/lib/api-auth';

/**
 * メンバー詳細を取得（チーム所属情報含む）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const { id: membershipId } = params;

    // メンバーシップを取得
    const membership = await prisma.organizationMember.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            teamMemberships: {
              where: {
                team: { organizationId },
              },
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 組織内の全チームを取得
    const allTeams = await prisma.team.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        color: true,
        isDefault: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      member: {
        id: membership.id,
        userId: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        image: membership.user.image,
        role: membership.role,
        teams: membership.user.teamMemberships.map((tm) => ({
          id: tm.team.id,
          name: tm.team.name,
          color: tm.team.color,
          role: tm.role,
        })),
      },
      allTeams,
    });
  } catch (error) {
    console.error('[MEMBER] GET Error:', error);
    return NextResponse.json(
      { error: 'メンバー情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * メンバーの権限・チーム所属を更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 管理者権限をチェック
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: 'メンバーを編集する権限がありません' },
      { status: 403 }
    );
  }

  try {
    const { organizationId, userId: currentUserId, role: currentUserRole } = auth;
    const { id: membershipId } = params;
    const body = await request.json();
    const { role, teamIds } = body;

    // 対象メンバーシップを取得
    const membership = await prisma.organizationMember.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // オーナーの権限変更は他のオーナーのみ可能
    if (membership.role === 'owner' && currentUserRole !== 'owner') {
      return NextResponse.json(
        { error: 'オーナーの権限は変更できません' },
        { status: 403 }
      );
    }

    // 自分自身のオーナー権限は変更不可（組織に最低1人のオーナーが必要）
    if (membership.userId === currentUserId && membership.role === 'owner' && role !== 'owner') {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: 'owner',
        },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: '組織には最低1人のオーナーが必要です' },
          { status: 400 }
        );
      }
    }

    // トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // 組織内の権限を更新
      if (role && role !== membership.role) {
        await tx.organizationMember.update({
          where: { id: membershipId },
          data: { role },
        });
      }

      // チーム所属を更新
      if (teamIds !== undefined) {
        // 現在のチーム所属を取得
        const currentTeamMemberships = await tx.teamMember.findMany({
          where: {
            userId: membership.userId,
            team: { organizationId },
          },
        });

        const currentTeamIds = currentTeamMemberships.map((tm) => tm.teamId);
        const newTeamIds: string[] = teamIds || [];

        // 削除するチーム
        const teamsToRemove = currentTeamIds.filter((id) => !newTeamIds.includes(id));
        // 追加するチーム
        const teamsToAdd = newTeamIds.filter((id: string) => !currentTeamIds.includes(id));

        // チームから削除
        if (teamsToRemove.length > 0) {
          await tx.teamMember.deleteMany({
            where: {
              userId: membership.userId,
              teamId: { in: teamsToRemove },
            },
          });
        }

        // チームに追加
        for (const teamId of teamsToAdd) {
          await tx.teamMember.create({
            data: {
              userId: membership.userId,
              teamId,
              role: 'member', // デフォルトはmember
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'メンバー情報を更新しました',
    });
  } catch (error) {
    console.error('[MEMBER] PUT Error:', error);
    return NextResponse.json(
      { error: 'メンバー情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * メンバーを組織から削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 管理者権限をチェック
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: 'メンバーを削除する権限がありません' },
      { status: 403 }
    );
  }

  try {
    const { organizationId, userId: currentUserId, role: currentUserRole } = auth;
    const { id: membershipId } = params;

    // 対象メンバーシップを取得
    const membership = await prisma.organizationMember.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // オーナーは削除不可（adminからは）
    if (membership.role === 'owner' && currentUserRole !== 'owner') {
      return NextResponse.json(
        { error: 'オーナーを削除する権限がありません' },
        { status: 403 }
      );
    }

    // 自分自身は削除不可
    if (membership.userId === currentUserId) {
      return NextResponse.json(
        { error: '自分自身を削除することはできません' },
        { status: 400 }
      );
    }

    // 最後のオーナーは削除不可
    if (membership.role === 'owner') {
      const ownerCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: 'owner',
        },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: '組織には最低1人のオーナーが必要です' },
          { status: 400 }
        );
      }
    }

    // トランザクションで削除
    await prisma.$transaction(async (tx) => {
      // チームメンバーシップも削除
      await tx.teamMember.deleteMany({
        where: {
          userId: membership.userId,
          team: { organizationId },
        },
      });

      // 組織メンバーシップを削除
      await tx.organizationMember.delete({
        where: { id: membershipId },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'メンバーを削除しました',
    });
  } catch (error) {
    console.error('[MEMBER] DELETE Error:', error);
    return NextResponse.json(
      { error: 'メンバーの削除に失敗しました' },
      { status: 500 }
    );
  }
}
