/**
 * クライアント報告書生成サービス
 *
 * 録画データとテンプレートからクライアント向け報告書を生成
 */

import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import type {
  TemplateVariables,
  ReportGenerationResult,
  ReportGenerationOptions,
} from './types.js';

/**
 * 日付をフォーマット
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * 時刻をフォーマット
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 要約テキストから議論内容を抽出
 */
function extractDiscussions(summary: string): string[] {
  const discussions: string[] = [];

  // 「主な議論」「議論ポイント」セクションを探す
  const patterns = [
    /##?\s*主な議論[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*議論ポイント[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*議論内容[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) {
      const bullets = match[1].match(/[-•]\s*(.+)/g);
      if (bullets) {
        discussions.push(...bullets.map((b) => b.replace(/^[-•]\s*/, '').trim()));
      }
      break;
    }
  }

  return discussions;
}

/**
 * 要約テキストから決定事項を抽出
 */
function extractDecisions(summary: string): string[] {
  const decisions: string[] = [];

  const patterns = [
    /##?\s*決定事項[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*決まったこと[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) {
      const bullets = match[1].match(/[-•]\s*(.+)/g);
      if (bullets) {
        decisions.push(...bullets.map((b) => b.replace(/^[-•]\s*/, '').trim()));
      }
      break;
    }
  }

  return decisions;
}

/**
 * 要約テキストからアクションアイテムを抽出
 */
function extractActionItems(summary: string): string[] {
  const items: string[] = [];

  const patterns = [
    /##?\s*アクションアイテム[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•\[]|$)/i,
    /##?\s*今後のアクション[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•\[]|$)/i,
    /##?\s*次のアクション[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•\[]|$)/i,
    /##?\s*タスク[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•\[]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) {
      const bullets = match[1].match(/[-•\[]\s*\[?\s*[x ]?\s*\]?\s*(.+)/g);
      if (bullets) {
        items.push(
          ...bullets.map((item) =>
            item
              .replace(/^[-•]\s*/, '')
              .replace(/\[[ x]?\]\s*/, '')
              .trim()
          )
        );
      }
      break;
    }
  }

  return items;
}

/**
 * 要約テキストから次回予定を抽出
 */
function extractNextSteps(summary: string): string[] {
  const steps: string[] = [];

  const patterns = [
    /##?\s*次回[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*次回に向けて[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*フォローアップ[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
    /##?\s*今後の予定[：:]?\s*\n([\s\S]*?)(?=##|\n\n[^-•]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) {
      const bullets = match[1].match(/[-•]\s*(.+)/g);
      if (bullets) {
        steps.push(...bullets.map((b) => b.replace(/^[-•]\s*/, '').trim()));
      }
      break;
    }
  }

  return steps;
}

/**
 * 要約テキストから概要を抽出
 */
function extractOverview(summary: string): string {
  // 「概要」セクションを探す
  const overviewMatch = summary.match(/##?\s*概要[：:]?\s*\n([\s\S]*?)(?=##|\n\n[-•]|$)/i);
  if (overviewMatch) {
    return overviewMatch[1].trim();
  }

  // 最初の段落を返す
  const firstParagraph = summary.split('\n\n')[0];
  if (firstParagraph && !firstParagraph.startsWith('#')) {
    return firstParagraph.trim();
  }

  // 最初の見出し以外のテキストを返す
  const lines = summary.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('•')) {
      return trimmed;
    }
  }

  return '（概要なし）';
}

/**
 * 配列を箇条書き文字列に変換
 */
function toBulletList(items: string[]): string {
  if (items.length === 0) {
    return '（なし）';
  }
  return items.map((item) => `- ${item}`).join('\n');
}

/**
 * テンプレート変数を置換
 */
function applyTemplate(template: string, variables: TemplateVariables): string {
  let result = template;

  // 各変数を置換
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, value || '');
  }

  return result;
}

/**
 * 録画IDから報告書を生成
 */
export async function generateClientReport(
  recordingId: string,
  options: ReportGenerationOptions = {}
): Promise<ReportGenerationResult> {
  logger.info('クライアント報告書生成開始', { recordingId, options });

  try {
    // 録画データを取得
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        organization: true,
      },
    });

    if (!recording) {
      return {
        success: false,
        error: '録画が見つかりません',
      };
    }

    // 要約が必要
    if (!recording.summary) {
      return {
        success: false,
        error: '要約が生成されていません。先に要約を生成してください。',
      };
    }

    // テンプレートを取得
    let template;
    if (options.templateId) {
      template = await prisma.reportTemplate.findUnique({
        where: { id: options.templateId },
      });
      if (!template) {
        return {
          success: false,
          error: '指定されたテンプレートが見つかりません',
        };
      }
    } else {
      // デフォルトテンプレートを取得
      template = await prisma.reportTemplate.findFirst({
        where: {
          organizationId: recording.organizationId,
          isDefault: true,
          isActive: true,
        },
      });

      if (!template) {
        // デフォルトがなければ最初のアクティブテンプレート
        template = await prisma.reportTemplate.findFirst({
          where: {
            organizationId: recording.organizationId,
            isActive: true,
          },
        });
      }

      if (!template) {
        return {
          success: false,
          error: 'テンプレートが見つかりません。テンプレートを作成してください。',
        };
      }
    }

    // 要約からデータを抽出
    const summary = recording.summary;
    const discussions = extractDiscussions(summary);
    const decisions = extractDecisions(summary);
    const actionItems = extractActionItems(summary);
    const nextSteps = extractNextSteps(summary);
    const overview = extractOverview(summary);

    // テンプレート変数を構築
    const meetingDate = new Date(recording.meetingDate);
    const variables: TemplateVariables = {
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
      // カスタム変数で上書き
      ...options.customVariables,
    };

    // テンプレートを適用
    const report = applyTemplate(template.content, variables);

    logger.info('クライアント報告書生成完了', {
      recordingId,
      templateId: template.id,
      reportLength: report.length,
    });

    return {
      success: true,
      report,
      templateId: template.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('クライアント報告書生成失敗', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 報告書を生成してDBに保存
 */
export async function generateAndSaveClientReport(
  recordingId: string,
  options: ReportGenerationOptions = {}
): Promise<ReportGenerationResult> {
  const result = await generateClientReport(recordingId, options);

  if (result.success && result.report) {
    // DBに保存
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        clientReport: result.report,
        clientReportTemplateId: result.templateId,
        clientReportGeneratedAt: new Date(),
      },
    });

    logger.info('クライアント報告書をDBに保存', { recordingId });
  }

  return result;
}

/**
 * テンプレートのプレビュー（サンプルデータで）
 */
export function previewTemplate(templateContent: string): string {
  const sampleVariables: TemplateVariables = {
    date: '2024年1月15日',
    time: '14:00',
    datetime: '2024年1月15日 14:00',
    clientName: 'サンプル株式会社',
    title: '週次定例ミーティング',
    summary: 'プロジェクトの進捗確認と今後のスケジュールについて議論しました。',
    discussions: '- 新機能の実装スケジュール\n- テスト計画の確認\n- リリース日の調整',
    decisions: '- リリース日を2月1日に決定\n- 追加テストを実施する',
    actionItems: '- 田中：テスト仕様書作成（1/20まで）\n- 佐藤：環境構築完了（1/18まで）',
    nextSteps: '- 次回は1/22（月）14:00から\n- テスト結果のレビュー予定',
    youtubeUrl: 'https://youtube.com/watch?v=sample123',
    duration: '60',
  };

  return applyTemplate(templateContent, sampleVariables);
}
