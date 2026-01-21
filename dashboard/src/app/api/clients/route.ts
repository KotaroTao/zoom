/**
 * クライアント一覧API（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

interface ContactInfo {
  id?: string;
  type: string;
  url: string;
  label?: string | null;
  sortOrder?: number;
}

interface ClientInfo {
  id?: string;
  name: string | null;
  description?: string | null;
  color?: string | null;
  zoomUrl?: string | null;
  contactUrl?: string | null;
  contactType?: string | null;
  contacts?: ContactInfo[];
  isActive?: boolean;
  recordingCount: number;
  totalDuration: number;
  lastMeetingDate: Date | null;
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;

    // 登録済みクライアントを取得（連絡先も含む）
    const registeredClients = await prisma.client.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        contacts: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // 録画からクライアント統計を集計
    const clientStats = await prisma.recording.groupBy({
      by: ['clientName'],
      where: {
        organizationId,
        clientName: { not: null },
      },
      _count: { id: true },
      _sum: { duration: true },
      _max: { meetingDate: true },
    });

    // 統計をマップに変換
    const statsMap = new Map<string, {
      recordingCount: number;
      totalDuration: number;
      lastMeetingDate: Date | null;
    }>();

    clientStats.forEach((stat: {
      clientName: string | null;
      _count: { id: number };
      _sum: { duration: number | null };
      _max: { meetingDate: Date | null };
    }) => {
      if (stat.clientName) {
        statsMap.set(stat.clientName, {
          recordingCount: stat._count.id,
          totalDuration: stat._sum.duration || 0,
          lastMeetingDate: stat._max.meetingDate,
        });
      }
    });

    // 登録済みクライアントと統計をマージ
    const clients: ClientInfo[] = registeredClients.map((client: {
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      zoomUrl: string | null;
      contactUrl: string | null;
      contactType: string | null;
      isActive: boolean;
      contacts: { id: string; type: string; url: string; label: string | null; sortOrder: number }[];
    }) => {
      const stats = statsMap.get(client.name);
      statsMap.delete(client.name); // 処理済みとしてマーク
      return {
        id: client.id,
        name: client.name,
        description: client.description,
        color: client.color,
        zoomUrl: client.zoomUrl,
        contactUrl: client.contactUrl,
        contactType: client.contactType,
        contacts: client.contacts.map(c => ({
          id: c.id,
          type: c.type,
          url: c.url,
          label: c.label,
          sortOrder: c.sortOrder,
        })),
        isActive: client.isActive,
        recordingCount: stats?.recordingCount || 0,
        totalDuration: stats?.totalDuration || 0,
        lastMeetingDate: stats?.lastMeetingDate || null,
      };
    });

    // 未登録だが録画に存在するクライアントを追加
    statsMap.forEach((stats, name) => {
      clients.push({
        name,
        recordingCount: stats.recordingCount,
        totalDuration: stats.totalDuration,
        lastMeetingDate: stats.lastMeetingDate,
      });
    });

    // 録画数で降順ソート
    clients.sort((a: ClientInfo, b: ClientInfo) => b.recordingCount - a.recordingCount);

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Clients API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

// クライアント作成
export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const body = await request.json();
    const { name, description, color, zoomUrl, contactUrl, contactType, contacts } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'クライアント名は必須です' },
        { status: 400 }
      );
    }

    // 既存チェック
    const existing = await prisma.client.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '同じ名前のクライアントが既に存在します' },
        { status: 400 }
      );
    }

    // クライアントと連絡先を作成
    const client = await prisma.client.create({
      data: {
        organizationId,
        name: name.trim(),
        description: description || null,
        color: color || null,
        zoomUrl: zoomUrl || null,
        contactUrl: contactUrl || null,
        contactType: contactType || null,
        contacts: contacts && Array.isArray(contacts) ? {
          create: contacts.map((c: ContactInfo, index: number) => ({
            type: c.type,
            url: c.url,
            label: c.label || null,
            sortOrder: c.sortOrder ?? index,
          })),
        } : undefined,
      },
      include: {
        contacts: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: 'クライアントの作成に失敗しました' },
      { status: 500 }
    );
  }
}

// クライアント更新
export async function PUT(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const body = await request.json();
    const { id, name, description, color, zoomUrl, contactUrl, contactType, contacts, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'クライアントIDは必須です' },
        { status: 400 }
      );
    }

    // 所有権確認
    const existing = await prisma.client.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'クライアントが見つかりません' },
        { status: 404 }
      );
    }

    // トランザクションで更新
    const client = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 連絡先の更新（指定された場合）
      if (contacts !== undefined && Array.isArray(contacts)) {
        // 既存の連絡先を削除
        await tx.clientContact.deleteMany({
          where: { clientId: id },
        });

        // 新しい連絡先を作成
        if (contacts.length > 0) {
          await tx.clientContact.createMany({
            data: contacts.map((c: ContactInfo, index: number) => ({
              clientId: id,
              type: c.type,
              url: c.url,
              label: c.label || null,
              sortOrder: c.sortOrder ?? index,
            })),
          });
        }
      }

      // クライアント本体を更新
      return tx.client.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description }),
          ...(color !== undefined && { color }),
          ...(zoomUrl !== undefined && { zoomUrl: zoomUrl || null }),
          ...(contactUrl !== undefined && { contactUrl: contactUrl || null }),
          ...(contactType !== undefined && { contactType: contactType || null }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          contacts: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: 'クライアントの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// クライアント削除
export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'クライアントIDは必須です' },
        { status: 400 }
      );
    }

    // 所有権確認
    const existing = await prisma.client.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'クライアントが見つかりません' },
        { status: 404 }
      );
    }

    await prisma.client.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json(
      { error: 'クライアントの削除に失敗しました' },
      { status: 500 }
    );
  }
}
