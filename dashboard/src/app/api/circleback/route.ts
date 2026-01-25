/**
 * Circlebackミーティング一覧API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;

    const where: Record<string, unknown> = { organizationId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const [meetings, total] = await Promise.all([
      prisma.circlebackMeeting.findMany({
        where,
        orderBy: { circlebackCreatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { actionItems: true },
          },
        },
      }),
      prisma.circlebackMeeting.count({ where }),
    ]);

    // 参加者とタグをパース
    const parsedMeetings = meetings.map((m) => ({
      id: m.id,
      circlebackId: m.circlebackId,
      name: m.name,
      notes: m.notes,
      duration: m.duration,
      attendees: m.attendees ? JSON.parse(m.attendees) : [],
      tags: m.tags ? JSON.parse(m.tags) : [],
      actionItemCount: m._count.actionItems,
      circlebackCreatedAt: m.circlebackCreatedAt,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      meetings: parsedMeetings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Circleback meetings API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch circleback meetings' },
      { status: 500 }
    );
  }
}
