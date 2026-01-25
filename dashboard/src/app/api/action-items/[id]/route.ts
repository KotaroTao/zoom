import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// アクションアイテムのステータス更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const { id } = await params;
    const body = await request.json();
    const { status, dueDate } = body;

    // アクションアイテムが組織に属しているか確認
    const actionItem = await prisma.circlebackActionItem.findFirst({
      where: { id },
      include: {
        meeting: {
          select: { organizationId: true },
        },
      },
    });

    if (!actionItem || actionItem.meeting.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 更新
    const updated = await prisma.circlebackActionItem.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    });

    return NextResponse.json({
      success: true,
      actionItem: {
        id: updated.id,
        status: updated.status,
        dueDate: updated.dueDate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Action item update error:', error);
    return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 });
  }
}
