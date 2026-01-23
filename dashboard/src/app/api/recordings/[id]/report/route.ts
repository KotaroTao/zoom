/**
 * クライアント報告書API（テナント分離対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthContext, unauthorizedResponse, noOrganizationResponse } from '@/lib/api-auth';

// 報告書取得
export async function GET(
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
      select: {
        clientReport: true,
        clientReportTemplateId: true,
        clientReportGeneratedAt: true,
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    if (!recording.clientReport) {
      return NextResponse.json(
        { error: '報告書がまだ生成されていません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report: recording.clientReport,
      templateId: recording.clientReportTemplateId,
      generatedAt: recording.clientReportGeneratedAt,
    });
  } catch (error) {
    console.error('Report GET error:', error);
    return NextResponse.json(
      { error: '報告書の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 報告書生成
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
    const body = await request.json();
    const { templateId, save } = body;

    // 録画を取得
    const recording = await prisma.recording.findFirst({
      where: { id, organizationId },
    });

    if (!recording) {
      return NextResponse.json(
        { error: '録画が見つかりません' },
        { status: 404 }
      );
    }

    if (!recording.summary) {
      return NextResponse.json(
        { error: '要約が生成されていません。先に要約を生成してください。' },
        { status: 400 }
      );
    }

    // テンプレート取得
    let template;
    if (templateId) {
      template = await prisma.reportTemplate.findFirst({
        where: { id: templateId, organizationId },
      });
      if (!template) {
        return NextResponse.json(
          { error: '指定されたテンプレートが見つかりません' },
          { status: 404 }
        );
      }
    } else {
      // デフォルトテンプレート
      template = await prisma.reportTemplate.findFirst({
        where: { organizationId, isDefault: true, isActive: true },
      });
      if (!template) {
        template = await prisma.reportTemplate.findFirst({
          where: { organizationId, isActive: true },
        });
      }
      if (!template) {
        return NextResponse.json(
          { error: 'テンプレートが見つかりません。テンプレートを作成してください。' },
          { status: 404 }
        );
      }
    }

    // 報告書生成
    const report = generateReport(recording, template.content);

    // DBに保存
    if (save) {
      await prisma.recording.update({
        where: { id },
        data: {
          clientReport: report,
          clientReportTemplateId: template.id,
          clientReportGeneratedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      report,
      templateId: template.id,
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: '報告書の生成に失敗しました' },
      { status: 500 }
    );
  }
}

// 報告書生成ヘルパー関数
function generateReport(recording: {
  title: string;
  clientName: string | null;
  meetingDate: Date;
  summary: string | null;
  youtubeUrl: string | null;
  duration: number | null;
}, templateContent: string): string {
  const summary = recording.summary || '';

  // 日付フォーマット
  const meetingDate = new Date(recording.meetingDate);
  const formatDate = (d: Date) => {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };
  const formatTime = (d: Date) => {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // 要約からセクションを抽出
  const extractSection = (text: string, patterns: RegExp[]): string[] => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const bullets = match[1].match(/[-•]\s*(.+)/g);
        if (bullets) {
          return bullets.map((b) => b.replace(/^[-•]\s*/, '').trim());
        }
      }
    }
    return [];
  };

  const discussions = extractSection(summary, [
    /##?\s*主な議論[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*議論[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
  ]);

  const decisions = extractSection(summary, [
    /##?\s*決定事項[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
  ]);

  const actionItems = extractSection(summary, [
    /##?\s*アクションアイテム[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•\[]|$)/i,
    /##?\s*今後のアクション[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•\[]|$)/i,
  ]);

  const nextSteps = extractSection(summary, [
    /##?\s*次回[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*次回に向けて[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
  ]);

  // 概要抽出
  const overviewMatch = summary.match(/##?\s*概要[：:]?\s*\n([\s\S]*?)(?=##|\n\n[-•]|$)/i);
  const overview = overviewMatch ? overviewMatch[1].trim() : summary.split('\n\n')[0] || '（概要なし）';

  // 箇条書きに変換
  const toBulletList = (items: string[]) => items.length ? items.map(i => `- ${i}`).join('\n') : '（なし）';

  // 変数置換
  const variables: Record<string, string> = {
    date: formatDate(meetingDate),
    time: formatTime(meetingDate),
    datetime: `${formatDate(meetingDate)} ${formatTime(meetingDate)}`,
    clientName: recording.clientName || '（クライアント名未設定）',
    title: recording.title,
    summary: overview,
    discussions: toBulletList(discussions),
    decisions: toBulletList(decisions),
    actionItems: toBulletList(actionItems),
    nextSteps: toBulletList(nextSteps),
    youtubeUrl: recording.youtubeUrl || '（未アップロード）',
    duration: recording.duration ? `${recording.duration}` : '不明',
  };

  let result = templateContent;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, value);
  }

  return result;
}
