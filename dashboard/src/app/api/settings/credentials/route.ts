/**
 * API認証情報更新API（テナント分離対応）
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
 * API認証情報を更新
 */
export async function PUT(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  // 組織未所属の場合は設定変更不可
  if (!auth.organizationId) {
    return NextResponse.json(
      { error: '組織に参加するとAPI認証情報を設定できます', noOrganization: true },
      { status: 403 }
    );
  }

  // 管理者権限をチェック
  if (!isAdmin(auth.role)) {
    return NextResponse.json(
      { error: 'API認証情報を変更する権限がありません' },
      { status: 403 }
    );
  }

  try {
    const { organizationId } = auth;
    const body = await request.json();

    const {
      zoomAccountId,
      zoomClientId,
      zoomClientSecret,
      zoomWebhookSecretToken,
      openaiApiKey,
      googleClientId,
      googleClientSecret,
      googleSpreadsheetId,
      notionApiKey,
      notionDatabaseId,
    } = body;

    // 空文字列の場合はnullに変換（既存の値を消去しない）
    const updateData: Record<string, string | undefined> = {};

    if (zoomAccountId !== undefined && zoomAccountId !== '') {
      updateData.zoomAccountId = zoomAccountId;
    }
    if (zoomClientId !== undefined && zoomClientId !== '') {
      updateData.zoomClientId = zoomClientId;
    }
    if (zoomClientSecret !== undefined && zoomClientSecret !== '') {
      updateData.zoomClientSecret = zoomClientSecret;
    }
    if (zoomWebhookSecretToken !== undefined && zoomWebhookSecretToken !== '') {
      updateData.zoomWebhookSecretToken = zoomWebhookSecretToken;
    }
    if (openaiApiKey !== undefined && openaiApiKey !== '') {
      updateData.openaiApiKey = openaiApiKey;
    }
    if (googleClientId !== undefined && googleClientId !== '') {
      updateData.googleClientId = googleClientId;
    }
    if (googleClientSecret !== undefined && googleClientSecret !== '') {
      updateData.googleClientSecret = googleClientSecret;
    }
    if (googleSpreadsheetId !== undefined && googleSpreadsheetId !== '') {
      updateData.googleSpreadsheetId = googleSpreadsheetId;
    }
    if (notionApiKey !== undefined && notionApiKey !== '') {
      updateData.notionApiKey = notionApiKey;
    }
    if (notionDatabaseId !== undefined && notionDatabaseId !== '') {
      updateData.notionDatabaseId = notionDatabaseId;
    }

    const settings = await prisma.settings.upsert({
      where: { organizationId },
      update: updateData,
      create: {
        organizationId,
        ...updateData,
      },
    });

    // マスクして返す
    return NextResponse.json({
      success: true,
      message: 'API認証情報を更新しました',
      zoomAccountId: maskSecret(settings.zoomAccountId),
      zoomClientId: maskSecret(settings.zoomClientId),
      zoomClientSecret: maskSecret(settings.zoomClientSecret),
      zoomWebhookSecretToken: maskSecret(settings.zoomWebhookSecretToken),
      openaiApiKey: maskSecret(settings.openaiApiKey),
      googleClientId: maskSecret(settings.googleClientId),
      googleClientSecret: maskSecret(settings.googleClientSecret),
      googleSpreadsheetId: settings.googleSpreadsheetId,
      notionApiKey: maskSecret(settings.notionApiKey),
      notionDatabaseId: settings.notionDatabaseId,
    });
  } catch (error) {
    console.error('Credentials PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update credentials' },
      { status: 500 }
    );
  }
}
