/**
 * Notion API クライアント
 */

import { Client } from '@notionhq/client';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type {
  MeetingPageProperties,
  CreatePageResult,
  NOTION_PROPERTY_NAMES,
} from './types.js';

// Notionクライアント（設定されている場合のみ初期化）
let notionClient: Client | null = null;

/**
 * Notionクライアントを取得
 */
function getNotionClient(): Client {
  if (!config.notion.apiKey) {
    throw new Error('NOTION_API_KEY が設定されていません');
  }

  if (!notionClient) {
    notionClient = new Client({
      auth: config.notion.apiKey,
    });
  }

  return notionClient;
}

/**
 * Notion連携が有効かどうか
 */
export function isNotionEnabled(): boolean {
  return !!(config.notion.apiKey && config.notion.databaseId);
}

/**
 * データベースにページを作成
 */
export async function createMeetingPage(
  data: MeetingPageProperties,
  propertyNames: typeof NOTION_PROPERTY_NAMES = {
    title: 'タイトル',
    clientName: 'クライアント',
    meetingDate: '開催日時',
    youtubeUrl: 'YouTube',
    summary: '要約',
    zoomUrl: 'Zoom URL',
    duration: '時間（分）',
    hostEmail: 'ホスト',
    status: 'ステータス',
  }
): Promise<CreatePageResult> {
  if (!isNotionEnabled()) {
    logger.debug('Notion連携は無効です');
    return {
      success: false,
      error: 'Notion連携が設定されていません',
    };
  }

  logger.info('Notionページ作成', {
    title: data.title,
    clientName: data.clientName,
  });

  try {
    const notion = getNotionClient();
    const databaseId = config.notion.databaseId!;

    // プロパティを構築
    const properties: Record<string, unknown> = {
      // タイトル（必須）
      [propertyNames.title]: {
        title: [
          {
            text: {
              content: data.title,
            },
          },
        ],
      },
    };

    // クライアント名（select）
    if (data.clientName) {
      properties[propertyNames.clientName] = {
        select: {
          name: data.clientName,
        },
      };
    }

    // 開催日時（date）
    properties[propertyNames.meetingDate] = {
      date: {
        start: data.meetingDate.toISOString(),
        time_zone: 'Asia/Tokyo',
      },
    };

    // YouTube URL
    if (data.youtubeUrl) {
      properties[propertyNames.youtubeUrl] = {
        url: data.youtubeUrl,
      };
    }

    // Zoom URL
    properties[propertyNames.zoomUrl] = {
      url: data.zoomUrl,
    };

    // 録画時間（number）
    if (data.duration) {
      properties[propertyNames.duration] = {
        number: data.duration,
      };
    }

    // ホストメール（email）
    if (data.hostEmail) {
      properties[propertyNames.hostEmail] = {
        email: data.hostEmail,
      };
    }

    // ステータス
    if (data.status) {
      const statusName = {
        completed: '完了',
        processing: '処理中',
        failed: '失敗',
      }[data.status];

      properties[propertyNames.status] = {
        status: {
          name: statusName,
        },
      };
    }

    // ページを作成
    const response = await notion.pages.create({
      parent: {
        database_id: databaseId,
      },
      properties: properties as Parameters<typeof notion.pages.create>[0]['properties'],
      // 要約をページ本文に追加
      children: data.summary
        ? [
            {
              object: 'block' as const,
              type: 'heading_2' as const,
              heading_2: {
                rich_text: [
                  {
                    type: 'text' as const,
                    text: {
                      content: '要約',
                    },
                  },
                ],
              },
            },
            {
              object: 'block' as const,
              type: 'paragraph' as const,
              paragraph: {
                rich_text: [
                  {
                    type: 'text' as const,
                    text: {
                      content: data.summary.substring(0, 2000), // Notionの制限
                    },
                  },
                ],
              },
            },
          ]
        : [],
    });

    const pageId = response.id;
    const pageUrl = `https://notion.so/${pageId.replace(/-/g, '')}`;

    logger.info('Notionページ作成完了', {
      pageId,
      pageUrl,
    });

    return {
      success: true,
      pageId,
      pageUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Notionページ作成失敗', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * ページを更新
 */
export async function updateMeetingPage(
  pageId: string,
  data: Partial<MeetingPageProperties>,
  propertyNames: typeof NOTION_PROPERTY_NAMES = {
    title: 'タイトル',
    clientName: 'クライアント',
    meetingDate: '開催日時',
    youtubeUrl: 'YouTube',
    summary: '要約',
    zoomUrl: 'Zoom URL',
    duration: '時間（分）',
    hostEmail: 'ホスト',
    status: 'ステータス',
  }
): Promise<boolean> {
  if (!isNotionEnabled()) {
    return false;
  }

  logger.info('Notionページ更新', { pageId });

  try {
    const notion = getNotionClient();

    const properties: Record<string, unknown> = {};

    if (data.youtubeUrl) {
      properties[propertyNames.youtubeUrl] = {
        url: data.youtubeUrl,
      };
    }

    if (data.status) {
      const statusName = {
        completed: '完了',
        processing: '処理中',
        failed: '失敗',
      }[data.status];

      properties[propertyNames.status] = {
        status: {
          name: statusName,
        },
      };
    }

    await notion.pages.update({
      page_id: pageId,
      properties: properties as Parameters<typeof notion.pages.update>[0]['properties'],
    });

    logger.info('Notionページ更新完了', { pageId });
    return true;
  } catch (error) {
    logger.error('Notionページ更新失敗', { pageId, error });
    return false;
  }
}

/**
 * クライアント別のページを取得
 */
export async function getPagesByClient(
  clientName: string,
  propertyNames: typeof NOTION_PROPERTY_NAMES = {
    title: 'タイトル',
    clientName: 'クライアント',
    meetingDate: '開催日時',
    youtubeUrl: 'YouTube',
    summary: '要約',
    zoomUrl: 'Zoom URL',
    duration: '時間（分）',
    hostEmail: 'ホスト',
    status: 'ステータス',
  }
): Promise<Array<{ id: string; title: string; date: string }> | null> {
  if (!isNotionEnabled()) {
    return null;
  }

  try {
    const notion = getNotionClient();
    const databaseId = config.notion.databaseId!;

    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: propertyNames.clientName,
        select: {
          equals: clientName,
        },
      },
      sorts: [
        {
          property: propertyNames.meetingDate,
          direction: 'descending',
        },
      ],
    });

    return response.results.map((page) => {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const titleProp = props[propertyNames.title] as { title?: Array<{ plain_text: string }> };
      const dateProp = props[propertyNames.meetingDate] as { date?: { start: string } };

      return {
        id: page.id,
        title: titleProp?.title?.[0]?.plain_text || '',
        date: dateProp?.date?.start || '',
      };
    });
  } catch (error) {
    logger.error('ページ取得失敗', { clientName, error });
    return null;
  }
}

/**
 * データベースの存在確認
 */
export async function verifyDatabase(): Promise<boolean> {
  if (!isNotionEnabled()) {
    return false;
  }

  try {
    const notion = getNotionClient();
    const databaseId = config.notion.databaseId!;

    const response = await notion.databases.retrieve({
      database_id: databaseId,
    });

    logger.info('Notionデータベース確認OK', {
      title: (response as { title?: Array<{ plain_text: string }> }).title?.[0]?.plain_text,
    });

    return true;
  } catch (error) {
    logger.error('Notionデータベース確認失敗', { error });
    return false;
  }
}
