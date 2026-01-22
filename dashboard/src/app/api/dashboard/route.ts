/**
 * ダッシュボードAPI（アクション指向）
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

    // 今日の開始時刻
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今週の開始時刻（月曜日）
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    // 並行してデータ取得
    const [
      // 処理失敗した録画
      failedRecordings,
      // クライアント未設定の録画
      noClientRecordings,
      // 要約未生成の録画（文字起こしはある）
      noSummaryRecordings,
      // 今日の録画
      todaysRecordings,
      // 今週のクライアント活動
      weeklyClientActivity,
      // 基本統計
      totalRecordings,
      completedCount,
    ] = await Promise.all([
      // 失敗した録画（最新5件）
      prisma.recording.findMany({
        where: {
          organizationId,
          status: 'FAILED',
        },
        orderBy: { meetingDate: 'desc' },
        take: 5,
      }),
      // クライアント未設定（最新10件）
      prisma.recording.findMany({
        where: {
          organizationId,
          clientName: null,
        },
        orderBy: { meetingDate: 'desc' },
        take: 10,
      }),
      // 要約未生成（文字起こしあり、要約なし）
      prisma.recording.findMany({
        where: {
          organizationId,
          transcript: { not: null },
          summary: null,
          status: { not: 'FAILED' },
        },
        orderBy: { meetingDate: 'desc' },
        take: 5,
      }),
      // 今日の録画
      prisma.recording.findMany({
        where: {
          organizationId,
          meetingDate: { gte: today },
        },
        orderBy: { meetingDate: 'desc' },
      }),
      // 今週のクライアント活動（クライアントごとの録画数）
      prisma.recording.groupBy({
        by: ['clientName'],
        where: {
          organizationId,
          clientName: { not: null },
          meetingDate: { gte: weekStart },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // 総録画数
      prisma.recording.count({ where: { organizationId } }),
      // 処理完了数
      prisma.recording.count({
        where: { organizationId, status: 'COMPLETED' },
      }),
    ]);

    // アクションアイテムを構築
    const actionItems = {
      failed: failedRecordings,
      noClient: noClientRecordings,
      noSummary: noSummaryRecordings,
      counts: {
        failed: failedRecordings.length,
        noClient: noClientRecordings.length,
        noSummary: noSummaryRecordings.length,
      },
    };

    // 今週のクライアント活動を整形
    const weeklyClients = weeklyClientActivity.map((item) => ({
      clientName: item.clientName,
      recordingCount: item._count.id,
    }));

    return NextResponse.json({
      actionItems,
      todaysRecordings,
      weeklyClients,
      stats: {
        totalRecordings,
        completedCount,
        completionRate: totalRecordings > 0
          ? Math.round((completedCount / totalRecordings) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
