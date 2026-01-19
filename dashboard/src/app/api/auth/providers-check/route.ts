/**
 * 利用可能な認証プロバイダーを確認するAPI
 */

import { NextResponse } from 'next/server';

// ビルド時ではなくランタイムで評価するように強制
export const dynamic = 'force-dynamic';

export async function GET() {
  const isGoogleOAuthConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return NextResponse.json({
    google: isGoogleOAuthConfigured,
    credentials: true, // メール/パスワードは常に有効
  });
}
