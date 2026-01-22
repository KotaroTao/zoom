/**
 * 録画再処理API（テナント分離対応）
 * バックエンドサーバーにプロキシして再処理を実行
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

// バックエンドサーバーのURL
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

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

    // バックエンドに再処理リクエストを送信
    const backendResponse = await fetch(`${BACKEND_URL}/api/recordings/${id}/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: result.error || '再処理に失敗しました' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reprocess API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '再処理に失敗しました' },
      { status: 500 }
    );
  }
}
