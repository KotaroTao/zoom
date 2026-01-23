/**
 * 同じ組織タグを持つメンバー一覧API
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    // 自分の組織タグを取得
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organization: true },
    });

    if (!currentUser?.organization) {
      return NextResponse.json({
        members: [],
        organization: null,
      });
    }

    // 同じ組織タグを持つユーザーを取得
    const members = await prisma.user.findMany({
      where: {
        organization: currentUser.organization,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      members,
      organization: currentUser.organization,
    });
  } catch (error) {
    console.error('Get organization members error:', error);
    return NextResponse.json(
      { error: 'メンバー情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
