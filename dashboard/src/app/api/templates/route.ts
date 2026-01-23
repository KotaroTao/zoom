/**
 * レポートテンプレートAPI（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, noOrganizationResponse } from '@/lib/api-auth';

// テンプレート一覧取得
export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return NextResponse.json({ templates: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = { organizationId };
    if (!includeInactive) {
      where.isActive = true;
    }

    const templates = await prisma.reportTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Templates GET error:', error);
    return NextResponse.json(
      { error: 'テンプレート一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// テンプレート作成
export async function POST(request: NextRequest) {
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
    const { name, description, content, isDefault } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: 'テンプレート名と本文は必須です' },
        { status: 400 }
      );
    }

    // デフォルトに設定する場合、既存のデフォルトを解除
    if (isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.reportTemplate.create({
      data: {
        organizationId,
        name,
        description: description || null,
        content,
        isDefault: isDefault || false,
        isActive: true,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Template POST error:', error);
    return NextResponse.json(
      { error: 'テンプレートの作成に失敗しました' },
      { status: 500 }
    );
  }
}
