/**
 * 設定API（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, isAdmin } from '@/lib/api-auth';

/**
 * 文字列をマスクする
 */
function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

/**
 * 設定を取得
 */
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;

    // 組織の設定を取得（存在しない場合は作成）
    let settings = await prisma.settings.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { organizationId },
      });
    }

    // 機密情報をマスクして返す
    const maskedSettings = {
      ...settings,
      zoomAccountId: maskSecret(settings.zoomAccountId),
      zoomClientId: maskSecret(settings.zoomClientId),
      zoomClientSecret: maskSecret(settings.zoomClientSecret),
      zoomWebhookSecretToken: maskSecret(settings.zoomWebhookSecretToken),
      openaiApiKey: maskSecret(settings.openaiApiKey),
      googleClientId: maskSecret(settings.googleClientId),
      googleClientSecret: maskSecret(settings.googleClientSecret),
      notionApiKey: maskSecret(settings.notionApiKey),
      circlebackWebhookSecret: maskSecret(settings.circlebackWebhookSecret),
    };

    return NextResponse.json(maskedSettings);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * 設定を更新
 */
export async function PUT(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 管理者権限をチェック
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: '設定を変更する権限がありません' },
      { status: 403 }
    );
  }

  try {
    const { organizationId } = auth;
    const body = await request.json();

    const {
      youtubeEnabled,
      youtubePrivacy,
      transcriptionEnabled,
      transcriptionLanguage,
      summaryEnabled,
      summaryStyle,
      sheetsEnabled,
      notionEnabled,
      circlebackEnabled,
    } = body;

    const settings = await prisma.settings.upsert({
      where: { organizationId },
      update: {
        youtubeEnabled,
        youtubePrivacy,
        transcriptionEnabled,
        transcriptionLanguage,
        summaryEnabled,
        summaryStyle,
        sheetsEnabled,
        notionEnabled,
        circlebackEnabled,
      },
      create: {
        organizationId,
        youtubeEnabled,
        youtubePrivacy,
        transcriptionEnabled,
        transcriptionLanguage,
        summaryEnabled,
        summaryStyle,
        sheetsEnabled,
        notionEnabled,
        circlebackEnabled,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
