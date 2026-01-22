/**
 * 組織メンバー管理API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getAuthContext,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  canModifyRole,
  getRoleLabel,
  PERMISSIONS,
  checkPermission,
} from '@/lib/api-auth';

/**
 * メンバー一覧を取得
 */
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId, role } = auth;

    // 組織未所属の場合
    if (!organizationId) {
      return NextResponse.json({
        members: [],
        message: '組織に参加するとメンバー一覧が表示されます',
      });
    }

    // 権限チェック
    if (!checkPermission(role, PERMISSIONS.MEMBER_VIEW)) {
      return forbiddenResponse('メンバー一覧を閲覧する権限がありません');
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
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
      orderBy: { createdAt: 'asc' },
    });

    const formattedMembers = members.map((m: {
      id: string;
      role: string;
      createdAt: Date;
      user: { id: string; email: string; name: string | null; image: string | null };
    }) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      image: m.user.image,
      role: m.role,
      roleLabel: getRoleLabel(m.role),
      joinedAt: m.createdAt,
    }));

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error('Members GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

/**
 * メンバーの役割を更新
 */
export async function PUT(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId, role: myRole, userId: myUserId } = auth;

    // 組織未所属の場合
    if (!organizationId) {
      return forbiddenResponse('組織に参加するとメンバーを管理できます');
    }

    // 権限チェック
    if (!checkPermission(myRole, PERMISSIONS.MEMBER_EDIT)) {
      return forbiddenResponse('メンバーの役割を変更する権限がありません');
    }

    const body = await request.json();
    const { memberId, newRole } = body;

    if (!memberId || !newRole) {
      return NextResponse.json(
        { error: 'memberId と newRole が必要です' },
        { status: 400 }
      );
    }

    // 対象メンバーを取得
    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!targetMember || targetMember.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 自分自身の役割は変更不可
    if (targetMember.userId === myUserId) {
      return forbiddenResponse('自分自身の役割は変更できません');
    }

    // 対象の役割を変更する権限があるかチェック
    if (!canModifyRole(myRole, targetMember.role)) {
      return forbiddenResponse(`${getRoleLabel(targetMember.role)}の役割は変更できません`);
    }

    // 新しい役割に変更する権限があるかチェック
    if (!canModifyRole(myRole, newRole)) {
      return forbiddenResponse(`${getRoleLabel(newRole)}には変更できません`);
    }

    // 役割を更新
    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });

    return NextResponse.json({
      success: true,
      message: `${targetMember.user.email} の役割を ${getRoleLabel(newRole)} に変更しました`,
      member: {
        id: updated.id,
        role: updated.role,
        roleLabel: getRoleLabel(updated.role),
      },
    });
  } catch (error) {
    console.error('Members PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}

/**
 * メンバーを削除（組織から除外）
 */
export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId, role: myRole, userId: myUserId } = auth;

    // 組織未所属の場合
    if (!organizationId) {
      return forbiddenResponse('組織に参加するとメンバーを管理できます');
    }

    // 権限チェック
    if (!checkPermission(myRole, PERMISSIONS.MEMBER_REMOVE)) {
      return forbiddenResponse('メンバーを削除する権限がありません');
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { error: 'memberId が必要です' },
        { status: 400 }
      );
    }

    // 対象メンバーを取得
    const targetMember = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!targetMember || targetMember.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 自分自身は削除不可
    if (targetMember.userId === myUserId) {
      return forbiddenResponse('自分自身を削除することはできません');
    }

    // 対象の役割を削除する権限があるかチェック
    if (!canModifyRole(myRole, targetMember.role)) {
      return forbiddenResponse(`${getRoleLabel(targetMember.role)}は削除できません`);
    }

    // メンバーを削除
    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({
      success: true,
      message: `${targetMember.user.email} を組織から削除しました`,
    });
  } catch (error) {
    console.error('Members DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
