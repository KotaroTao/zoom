/**
 * Prisma シードデータ
 * デフォルトのレポートテンプレートを作成
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// デフォルトテンプレート定義
const defaultTemplates = [
  {
    name: '標準報告テンプレート',
    description: '一般的なミーティング報告に適した標準テンプレート',
    content: `【MTG報告】{{clientName}}様 {{date}}

■ 概要
{{summary}}

■ 主な議論内容
{{discussions}}

■ 決定事項
{{decisions}}

■ 今後のアクション
{{actionItems}}

■ 次回に向けて
{{nextSteps}}

---
録画URL: {{youtubeUrl}}
ミーティング時間: {{duration}}分`,
    isDefault: true,
  },
  {
    name: '簡易報告テンプレート',
    description: '短くシンプルな報告に適したテンプレート',
    content: `【{{date}} MTG報告】{{clientName}}様

{{summary}}

▼ 決定事項
{{decisions}}

▼ 次のアクション
{{actionItems}}

録画: {{youtubeUrl}}`,
    isDefault: false,
  },
  {
    name: '詳細議事録テンプレート',
    description: '詳細な議事録が必要な場合のテンプレート',
    content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
ミーティング議事録
━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 基本情報
クライアント: {{clientName}}様
日時: {{datetime}}
所要時間: {{duration}}分
タイトル: {{title}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ ミーティング概要
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{summary}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 議論の詳細
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{discussions}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 決定事項
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{decisions}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ アクションアイテム
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{actionItems}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 次回に向けて
━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{nextSteps}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 参考資料
━━━━━━━━━━━━━━━━━━━━━━━━━━━
録画URL: {{youtubeUrl}}`,
    isDefault: false,
  },
];

async function main() {
  console.log('シードデータ投入開始...');

  // 全組織を取得
  const organizations = await prisma.organization.findMany();

  if (organizations.length === 0) {
    console.log('組織が存在しません。組織を作成してから再実行してください。');
    return;
  }

  for (const org of organizations) {
    console.log(`組織「${org.name}」にテンプレートを作成中...`);

    // 既存のテンプレートを確認
    const existingTemplates = await prisma.reportTemplate.findMany({
      where: { organizationId: org.id },
    });

    if (existingTemplates.length > 0) {
      console.log(`  既に${existingTemplates.length}件のテンプレートが存在します。スキップ。`);
      continue;
    }

    // デフォルトテンプレートを作成
    for (const template of defaultTemplates) {
      await prisma.reportTemplate.create({
        data: {
          organizationId: org.id,
          name: template.name,
          description: template.description,
          content: template.content,
          isDefault: template.isDefault,
          isActive: true,
        },
      });
      console.log(`  テンプレート「${template.name}」を作成しました`);
    }
  }

  console.log('シードデータ投入完了');
}

main()
  .catch((e) => {
    console.error('シードエラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
