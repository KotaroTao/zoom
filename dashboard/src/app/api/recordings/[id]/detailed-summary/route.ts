/**
 * 詳細要約API（テナント分離対応）
 * バックエンドサーバーにプロキシして詳細要約を生成/取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

// バックエンドサーバーのURL
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

// 詳細要約を生成
export async function POST(
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

    // 録画の存在確認と権限チェック
    const recording = await prisma.recording.findFirst({
      where: { id, organizationId },
    });

    if (!recording) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    // バックエンドに詳細要約生成リクエストを送信
    const backendResponse = await fetch(`${BACKEND_URL}/api/recordings/${id}/detailed-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: result.error || '詳細要約の生成に失敗しました' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Detailed summary POST API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '詳細要約の生成に失敗しました' },
      { status: 500 }
    );
  }
}

// 詳細要約を取得
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

    // 録画の存在確認と権限チェック
    const recording = await prisma.recording.findFirst({
      where: { id, organizationId },
      select: {
        detailedSummary: true,
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    if (!recording.detailedSummary) {
      return NextResponse.json({
        success: false,
        summary: null,
        status: 'NOT_GENERATED',
      });
    }

    return NextResponse.json({
      success: true,
      summary: recording.detailedSummary,
    });
  } catch (error) {
    console.error('Detailed summary GET API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '詳細要約の取得に失敗しました' },
      { status: 500 }
    );
  }
}
