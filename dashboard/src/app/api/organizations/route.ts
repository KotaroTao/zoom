/**
 * 組織管理API
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions, generateSlug } from '@/lib/auth';

/**
 * 組織一覧を取得（自分が所属する組織）
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                recordings: true,
              },
            },
          },
        },
      },
    });

    const organizations = memberships.map((m: {
      role: string;
      organization: {
        id: string;
        name: string;
        slug: string;
        plan: string;
        createdAt: Date;
        _count: { members: number; recordings: number };
      };
    }) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      plan: m.organization.plan,
      role: m.role,
      memberCount: m.organization._count.members,
      recordingCount: m.organization._count.recordings,
      createdAt: m.organization.createdAt,
    }));

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('[ORGANIZATIONS] GET Error:', error);
    return NextResponse.json(
      { error: '組織一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 新しい組織を作成
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    // バリデーション
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: '組織名は必須です' },
        { status: 400 }
      );
    }

    // スラッグを生成
    let slug = generateSlug(name);

    // スラッグの重複チェック
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      // 重複する場合はタイムスタンプを追加
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // トランザクションで組織とメンバーシップを作成
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // 組織を作成
      const organization = await tx.organization.create({
        data: {
          name: name.trim(),
          slug,
        },
      });

      // 作成者をオーナーとして追加
      await tx.organizationMember.create({
        data: {
          userId: session.user.id,
          organizationId: organization.id,
          role: 'owner',
        },
      });

      // デフォルト設定を作成
      await tx.settings.create({
        data: {
          organizationId: organization.id,
        },
      });

      return organization;
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: result.id,
        name: result.name,
        slug: result.slug,
      },
    });
  } catch (error) {
    console.error('[ORGANIZATIONS] POST Error:', error);
    return NextResponse.json(
      { error: '組織の作成に失敗しました' },
      { status: 500 }
    );
  }
}
