/**
 * Circlebackミーティング詳細API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const { id } = await params;

    const meeting = await prisma.circlebackMeeting.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        actionItems: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: 'ミーティングが見つかりません' },
        { status: 404 }
      );
    }

    // 参加者とタグをパース
    const parsedMeeting = {
      id: meeting.id,
      circlebackId: meeting.circlebackId,
      name: meeting.name,
      notes: meeting.notes,
      transcript: meeting.transcript,
      recordingUrl: meeting.recordingUrl,
      duration: meeting.duration,
      icalUid: meeting.icalUid,
      attendees: meeting.attendees ? JSON.parse(meeting.attendees) : [],
      tags: meeting.tags ? JSON.parse(meeting.tags) : [],
      actionItems: meeting.actionItems.map((item) => ({
        id: item.id,
        circlebackId: item.circlebackId,
        title: item.title,
        description: item.description,
        status: item.status,
        assigneeName: item.assigneeName,
        assigneeEmail: item.assigneeEmail,
      })),
      circlebackCreatedAt: meeting.circlebackCreatedAt,
      createdAt: meeting.createdAt,
    };

    return NextResponse.json(parsedMeeting);
  } catch (error) {
    console.error('Circleback meeting detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch circleback meeting' },
      { status: 500 }
    );
  }
}

// アクションアイテムのステータス更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const { id } = await params;
    const body = await request.json();
    const { actionItemId, status } = body;

    if (!actionItemId || !status) {
      return NextResponse.json(
        { error: 'actionItemIdとstatusは必須です' },
        { status: 400 }
      );
    }

    if (!['PENDING', 'COMPLETED'].includes(status)) {
      return NextResponse.json(
        { error: 'statusはPENDINGまたはCOMPLETEDである必要があります' },
        { status: 400 }
      );
    }

    // アクションアイテムが組織に属しているか確認
    const actionItem = await prisma.circlebackActionItem.findFirst({
      where: { id: actionItemId },
      include: {
        meeting: {
          select: { organizationId: true, id: true },
        },
      },
    });

    if (!actionItem || actionItem.meeting.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'アクションアイテムが見つかりません' },
        { status: 404 }
      );
    }

    if (actionItem.meeting.id !== id) {
      return NextResponse.json(
        { error: 'アクションアイテムがこのミーティングに属していません' },
        { status: 400 }
      );
    }

    // ステータス更新
    const updated = await prisma.circlebackActionItem.update({
      where: { id: actionItemId },
      data: { status },
    });

    return NextResponse.json({ success: true, actionItem: updated });
  } catch (error) {
    console.error('Update action item error:', error);
    return NextResponse.json(
      { error: 'アクションアイテムの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// ミーティング削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const { id } = await params;

    // 所有権確認
    const meeting = await prisma.circlebackMeeting.findFirst({
      where: { id, organizationId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: 'ミーティングが見つかりません' },
        { status: 404 }
      );
    }

    // 削除（アクションアイテムはカスケード削除）
    await prisma.circlebackMeeting.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'ミーティングを削除しました' });
  } catch (error) {
    console.error('Delete circleback meeting error:', error);
    return NextResponse.json(
      { error: 'ミーティングの削除に失敗しました' },
      { status: 500 }
    );
  }
}
