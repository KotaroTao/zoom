/**
 * クライアント録画一覧API（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const { name } = await params;
    const clientName = decodeURIComponent(name);

    // クライアントの録画を取得
    const recordings = await prisma.recording.findMany({
      where: {
        organizationId,
        clientName,
      },
      orderBy: { meetingDate: 'desc' },
    });

    // 統計を計算
    const totalRecordings = recordings.length;
    const totalDuration = recordings.reduce((sum: number, r: { duration: number | null }) => sum + (r.duration || 0), 0);

    return NextResponse.json({
      clientName,
      recordings,
      stats: {
        totalRecordings,
        totalDuration,
      },
    });
  } catch (error) {
    console.error('Client recordings API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client recordings' },
      { status: 500 }
    );
  }
}
