/**
 * ユーザー組織タグAPI
 *
 * 同じ組織タグを持つユーザー間で録画を共有するための設定
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 組織タグを取得
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organization: true },
    });

    return NextResponse.json({
      organization: user?.organization || null,
    });
  } catch (error) {
    console.error('Get user organization error:', error);
    return NextResponse.json(
      { error: '組織情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 組織タグを更新
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { organization } = body;

    // 空文字の場合はnullに変換
    const orgValue = organization && organization.trim() ? organization.trim() : null;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { organization: orgValue },
      select: { id: true, organization: true },
    });

    return NextResponse.json({
      success: true,
      organization: user.organization,
    });
  } catch (error) {
    console.error('Update user organization error:', error);
    return NextResponse.json(
      { error: '組織情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}
