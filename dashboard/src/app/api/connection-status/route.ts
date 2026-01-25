/**
 * 接続ステータスAPI
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

    const settings = await prisma.settings.findUnique({
      where: { organizationId },
    });

    const status = {
      zoom: {
        connected: false,
        message: '未設定',
        configured: false,
      },
      youtube: {
        connected: false,
        message: '未設定',
        configured: false,
      },
      openai: {
        connected: false,
        message: '未設定',
        configured: false,
      },
      notion: {
        connected: false,
        message: '未設定',
        configured: false,
      },
      circleback: {
        connected: false,
        message: '未設定',
        configured: false,
      },
    };

    if (settings) {
      // Zoom
      if (settings.zoomAccountId && settings.zoomClientId && settings.zoomClientSecret) {
        status.zoom.configured = true;
        status.zoom.connected = true;
        status.zoom.message = '接続済み';
      }

      // YouTube/Google
      if (settings.googleClientId && settings.googleClientSecret && settings.googleSpreadsheetId) {
        status.youtube.configured = true;
        status.youtube.connected = true;
        status.youtube.message = '接続済み';
      } else if (settings.googleClientId && settings.googleClientSecret) {
        status.youtube.configured = true;
        status.youtube.connected = false;
        status.youtube.message = 'Spreadsheet IDが必要です';
      }

      // OpenAI
      if (settings.openaiApiKey) {
        status.openai.configured = true;
        status.openai.connected = true;
        status.openai.message = '接続済み';
      }

      // Notion
      if (settings.notionApiKey && settings.notionDatabaseId) {
        status.notion.configured = true;
        status.notion.connected = true;
        status.notion.message = '接続済み';
      } else if (settings.notionApiKey) {
        status.notion.configured = true;
        status.notion.connected = false;
        status.notion.message = 'Database IDが必要です';
      }

      // Circleback
      if (settings.circlebackWebhookSecret && settings.circlebackEnabled) {
        status.circleback.configured = true;
        status.circleback.connected = true;
        status.circleback.message = '接続済み';
      } else if (settings.circlebackWebhookSecret) {
        status.circleback.configured = true;
        status.circleback.connected = false;
        status.circleback.message = '連携が無効です';
      }
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Connection status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connection status' },
      { status: 500 }
    );
  }
}
