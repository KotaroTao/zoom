/**
 * 録画一覧API（テナント分離対応）
 *
 * 組織に所属しているユーザーは、その組織の全録画を閲覧可能
 * 組織未所属のユーザーは空の録画リストを返す
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
    const clientName = searchParams.get('client');
    const status = searchParams.get('status');

    // 組織未所属の場合は空の配列を返す
    if (!organizationId) {
      return NextResponse.json({
        recordings: [],
        total: 0,
        limit,
        offset,
        message: '組織に参加すると録画一覧が表示されます',
      });
    }

    const where: Record<string, unknown> = { organizationId };
    if (clientName) where.clientName = clientName;
    if (status) where.status = status;

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        orderBy: { meetingDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.recording.count({ where }),
    ]);

    return NextResponse.json({
      recordings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Recordings API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}
