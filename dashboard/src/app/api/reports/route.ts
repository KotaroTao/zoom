import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 週次/月次レポート取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly';
    const clientId = searchParams.get('clientId') || undefined;

    const now = new Date();
    let startDate: Date;
    let label: string;

    if (period === 'weekly') {
      // 今週の月曜日から
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      label = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${now.getMonth() + 1}/${now.getDate()}`;
    } else {
      // 今月の1日から
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    }

    const meetings = await prisma.circlebackMeeting.findMany({
      where: {
        organizationId,
        circlebackCreatedAt: { gte: startDate, lte: now },
        ...(clientId && { clientId }),
      },
      include: {
        client: { select: { id: true, name: true, color: true } },
        actionItems: true,
      },
      orderBy: { circlebackCreatedAt: 'desc' },
    });

    // クライアント別集計
    const byClientMap = new Map<string, {
      client: { id: string; name: string; color: string | null } | null;
      meetingCount: number;
      totalDuration: number;
      actionItems: { total: number; completed: number; pending: number; overdue: number };
    }>();

    let totalDuration = 0;
    let newActionItems = 0;
    let completedActionItems = 0;
    let overdueActionItems = 0;

    for (const meeting of meetings) {
      const clientKey = meeting.client?.id || 'none';
      const existing = byClientMap.get(clientKey) || {
        client: meeting.client || null,
        meetingCount: 0,
        totalDuration: 0,
        actionItems: { total: 0, completed: 0, pending: 0, overdue: 0 },
      };

      existing.meetingCount++;
      existing.totalDuration += meeting.duration || 0;
      totalDuration += meeting.duration || 0;

      for (const item of meeting.actionItems) {
        existing.actionItems.total++;
        newActionItems++;
        if (item.status === 'COMPLETED') {
          existing.actionItems.completed++;
          completedActionItems++;
        } else {
          existing.actionItems.pending++;
          if (item.dueDate && item.dueDate < now) {
            existing.actionItems.overdue++;
            overdueActionItems++;
          }
        }
      }

      byClientMap.set(clientKey, existing);
    }

    // クライアント一覧（選択用）
    const clients = await prisma.client.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      period: {
        start: startDate.toISOString(),
        end: now.toISOString(),
        label,
        type: period,
      },
      summary: {
        totalMeetings: meetings.length,
        totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
        newActionItems,
        completedActionItems,
        overdueActionItems,
      },
      byClient: Array.from(byClientMap.values())
        .map((c) => ({
          ...c,
          totalDurationFormatted: formatDuration(c.totalDuration),
        }))
        .sort((a, b) => b.meetingCount - a.meetingCount),
      meetings: meetings.map((m) => ({
        id: m.id,
        name: m.name,
        date: m.circlebackCreatedAt.toISOString(),
        duration: m.duration,
        durationFormatted: m.duration ? formatDuration(m.duration) : null,
        client: m.client,
        actionItemsCount: m.actionItems.length,
        actionItemsCompleted: m.actionItems.filter((a) => a.status === 'COMPLETED').length,
      })),
      clients,
    });
  } catch (error) {
    console.error('Reports fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }
  return `${minutes}分`;
}
