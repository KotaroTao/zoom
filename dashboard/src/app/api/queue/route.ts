/**
 * キューステータスAPI
 *
 * バックエンドAPIにプロキシしてキューステータスを取得
 * 注: 現状はグローバルキューのステータスを返す
 */

import { NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

// バックエンドAPIのベースURL
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    // バックエンドAPIにリクエスト
    const response = await fetch(`${BACKEND_API_URL}/api/queue`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Queue API error:', error);
    // エラー時はデフォルト値を返す
    return NextResponse.json({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    });
  }
}
