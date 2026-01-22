/**
 * クライアント一覧API（テナント分離対応）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

interface ClientInfo {
  name: string | null;
  recordingCount: number;
  totalDuration: number;
  lastMeetingDate: Date | null;
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;

    // 組織未所属の場合は空の配列を返す
    if (!organizationId) {
      return NextResponse.json({
        clients: [],
        message: '組織に参加するとクライアント一覧が表示されます',
      });
    }

    // 録画からユニークなクライアント名を集計
    const clientStats = await prisma.recording.groupBy({
      by: ['clientName'],
      where: {
        organizationId,
        clientName: { not: null },
      },
      _count: { id: true },
      _sum: { duration: true },
      _max: { meetingDate: true },
    });

    const clients: ClientInfo[] = clientStats.map((stat: {
      clientName: string | null;
      _count: { id: number };
      _sum: { duration: number | null };
      _max: { meetingDate: Date | null };
    }) => ({
      name: stat.clientName,
      recordingCount: stat._count.id,
      totalDuration: stat._sum.duration || 0,
      lastMeetingDate: stat._max.meetingDate,
    }));

    // 録画数で降順ソート
    clients.sort((a: ClientInfo, b: ClientInfo) => b.recordingCount - a.recordingCount);

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Clients API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
