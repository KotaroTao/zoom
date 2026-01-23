/**
 * 報告書送付ステータスAPI（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, noOrganizationResponse } from '@/lib/api-auth';

// 報告書を送付済みにする
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return noOrganizationResponse();
  }

  try {
    const { id } = await params;

    const recording = await prisma.recording.findFirst({
      where: { id, organizationId },
    });

    if (!recording) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    const now = new Date();
    await prisma.recording.update({
      where: { id },
      data: { reportSentAt: now },
    });

    return NextResponse.json({
      success: true,
      message: '報告書を送付済みにしました',
      reportSentAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Report sent error:', error);
    return NextResponse.json(
      { error: '送付ステータスの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 報告書送付ステータスをクリア
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  const { organizationId } = auth;
  if (!organizationId) {
    return noOrganizationResponse();
  }

  try {
    const { id } = await params;

    const recording = await prisma.recording.findFirst({
      where: { id, organizationId },
    });

    if (!recording) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    await prisma.recording.update({
      where: { id },
      data: { reportSentAt: null },
    });

    return NextResponse.json({
      success: true,
      message: '送付ステータスをクリアしました',
    });
  } catch (error) {
    console.error('Report sent clear error:', error);
    return NextResponse.json(
      { error: '送付ステータスのクリアに失敗しました' },
      { status: 500 }
    );
  }
}
