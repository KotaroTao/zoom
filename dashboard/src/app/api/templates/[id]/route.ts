/**
 * レポートテンプレート個別API（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, noOrganizationResponse } from '@/lib/api-auth';

// テンプレート詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return noOrganizationResponse();
  }

  try {
    const { id } = await params;

    const template = await prisma.reportTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Template GET error:', error);
    return NextResponse.json(
      { error: 'テンプレートの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// テンプレート更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return noOrganizationResponse();
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, content, isDefault, isActive } = body;

    const existing = await prisma.reportTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      );
    }

    // デフォルトに設定する場合、既存のデフォルトを解除
    if (isDefault && !existing.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.reportTemplate.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        content: content !== undefined ? content : existing.content,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Template PUT error:', error);
    return NextResponse.json(
      { error: 'テンプレートの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// テンプレート削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return noOrganizationResponse();
  }

  try {
    const { id } = await params;

    const existing = await prisma.reportTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      );
    }

    // デフォルトテンプレートは削除不可
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'デフォルトテンプレートは削除できません。先に別のテンプレートをデフォルトに設定してください。' },
        { status: 400 }
      );
    }

    await prisma.reportTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'テンプレートを削除しました' });
  } catch (error) {
    console.error('Template DELETE error:', error);
    return NextResponse.json(
      { error: 'テンプレートの削除に失敗しました' },
      { status: 500 }
    );
  }
}
