/**
 * テンプレートプレビューAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorizedResponse } from '@/lib/api-auth';

// サンプルデータでテンプレートをプレビュー
export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'テンプレート本文が必要です' },
        { status: 400 }
      );
    }

    // サンプルデータでプレビュー生成
    const sampleVariables: Record<string, string> = {
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

    let preview = content;
    for (const [key, value] of Object.entries(sampleVariables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      preview = preview.replace(pattern, value);
    }

    return NextResponse.json({ preview });
  } catch (error) {
    console.error('Template preview error:', error);
    return NextResponse.json(
      { error: 'プレビューの生成に失敗しました' },
      { status: 500 }
    );
  }
}
