import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// アクションアイテム一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const clientId = searchParams.get('clientId') || undefined;
    const overdue = searchParams.get('overdue') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const now = new Date();

    const where: any = {
      meeting: {
        organizationId,
        ...(clientId && { clientId }),
      },
      ...(status !== 'ALL' && { status }),
    };

    // 期限切れフィルタ
    if (overdue) {
      where.dueDate = { lt: now };
      where.status = 'PENDING';
    }

    const [items, total] = await Promise.all([
      prisma.circlebackActionItem.findMany({
        where,
        orderBy: [
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          meeting: {
            select: {
              id: true,
              name: true,
              circlebackCreatedAt: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
      }),
      prisma.circlebackActionItem.count({ where }),
    ]);

    // 期限切れサマリー
    const overdueSummary = await prisma.circlebackActionItem.count({
      where: {
        meeting: { organizationId },
        status: 'PENDING',
        dueDate: { lt: now },
      },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        assigneeName: item.assigneeName,
        assigneeEmail: item.assigneeEmail,
        dueDate: item.dueDate?.toISOString() || null,
        isOverdue: item.dueDate ? item.dueDate < now && item.status === 'PENDING' : false,
        meeting: {
          id: item.meeting.id,
          name: item.meeting.name,
          circlebackCreatedAt: item.meeting.circlebackCreatedAt.toISOString(),
        },
        client: item.meeting.client,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      overdueSummary,
    });
  } catch (error) {
    console.error('Action items fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch action items' }, { status: 500 });
  }
}
