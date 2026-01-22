/**
 * 統計情報API（テナント分離対応）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;

    // 組織未所属の場合はすべて0を返す
    if (!organizationId) {
      return NextResponse.json({
        totalRecordings: 0,
        totalClients: 0,
        totalDuration: 0,
        completedCount: 0,
        weeklyRecordings: 0,
        completionRate: 0,
        message: '組織に参加すると統計が表示されます',
      });
    }

    // 総録画数
    const totalRecordings = await prisma.recording.count({
      where: { organizationId },
    });

    // クライアント数（ユニーク）
    const clientsResult = await prisma.recording.groupBy({
      by: ['clientName'],
      where: {
        organizationId,
        clientName: { not: null },
      },
    });
    const totalClients = clientsResult.length;

    // 総録画時間（分）
    const durationResult = await prisma.recording.aggregate({
      where: { organizationId },
      _sum: { duration: true },
    });
    const totalDuration = durationResult._sum.duration || 0;

    // 処理完了数
    const completedCount = await prisma.recording.count({
      where: {
        organizationId,
        status: 'COMPLETED',
      },
    });

    // 今週の録画数
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyRecordings = await prisma.recording.count({
      where: {
        organizationId,
        createdAt: { gte: weekAgo },
      },
    });

    return NextResponse.json({
      totalRecordings,
      totalClients,
      totalDuration,
      completedCount,
      weeklyRecordings,
      completionRate: totalRecordings > 0
        ? Math.round((completedCount / totalRecordings) * 100)
        : 0,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
