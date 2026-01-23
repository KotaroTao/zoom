/**
 * マイグレーションスクリプト: 組織・チーム機能への移行
 *
 * 実行手順:
 * 1. prisma db push でスキーマを適用
 * 2. npx tsx scripts/migrate-to-teams.ts を実行
 *
 * 処理内容:
 * 1. 各組織に「全社」デフォルトチームを作成
 * 2. 組織メンバーをデフォルトチームのメンバーとしても追加
 * 3. 既存録画をデフォルトチームに紐付け
 * 4. 既存の Invitation に新しいフィールドを設定
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 組織・チーム機能マイグレーション開始 ===\n');

  // 1. 全組織を取得
  const organizations = await prisma.organization.findMany({
    include: {
      members: true,
      teams: true,
    },
  });

  console.log(`処理対象組織数: ${organizations.length}\n`);

  for (const org of organizations) {
    console.log(`\n--- 組織: ${org.name} (${org.id}) ---`);

    // 2. デフォルトチームが存在するか確認
    let defaultTeam = org.teams.find((t) => t.isDefault);

    if (!defaultTeam) {
      // デフォルトチームを作成
      console.log('  デフォルトチーム「全社」を作成...');
      defaultTeam = await prisma.team.create({
        data: {
          name: '全社',
          description: '組織全体のデフォルトチーム',
          isDefault: true,
          organizationId: org.id,
          color: '#3B82F6', // blue-500
        },
      });
      console.log(`  作成完了: ${defaultTeam.id}`);
    } else {
      console.log(`  デフォルトチーム既存: ${defaultTeam.name}`);
    }

    // 3. 組織メンバーをデフォルトチームに追加
    console.log(`  組織メンバーをチームに追加 (${org.members.length}人)...`);

    for (const member of org.members) {
      // 既存のチームメンバーシップを確認
      const existingTeamMember = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: member.userId,
            teamId: defaultTeam.id,
          },
        },
      });

      if (!existingTeamMember) {
        // 組織の役割をチームの役割にマッピング
        let teamRole = 'member';
        if (member.role === 'owner' || member.role === 'admin') {
          teamRole = 'admin';
        } else if (member.role === 'viewer') {
          teamRole = 'viewer';
        }

        await prisma.teamMember.create({
          data: {
            userId: member.userId,
            teamId: defaultTeam.id,
            role: teamRole,
          },
        });
        console.log(`    追加: userId=${member.userId}, role=${teamRole}`);
      } else {
        console.log(`    スキップ（既存）: userId=${member.userId}`);
      }
    }

    // 4. 既存録画をデフォルトチームに紐付け
    const recordingsWithoutTeam = await prisma.recording.findMany({
      where: {
        organizationId: org.id,
        teamId: null,
      },
    });

    if (recordingsWithoutTeam.length > 0) {
      console.log(`  録画をチームに紐付け (${recordingsWithoutTeam.length}件)...`);

      await prisma.recording.updateMany({
        where: {
          organizationId: org.id,
          teamId: null,
        },
        data: {
          teamId: defaultTeam.id,
        },
      });
      console.log('    完了');
    } else {
      console.log('  紐付け対象の録画なし');
    }
  }

  // 5. 既存の Invitation を更新（新フィールドにデフォルト値を設定）
  console.log('\n--- 招待データの更新 ---');

  const invitationsToUpdate = await prisma.invitation.findMany({
    where: {
      type: null as any, // typeがnullのもの（古いデータ）
    },
  });

  // SQLiteでは直接null checkできないので、全件取得して確認
  const allInvitations = await prisma.invitation.findMany();
  let updatedCount = 0;

  for (const inv of allInvitations) {
    // role フィールドが存在する古いデータの場合（orgRole がない）
    // Prismaスキーマ変更で role → orgRole になったので、実際にはDBレベルで対応が必要
    // ここでは type フィールドを organization に設定
    try {
      // @ts-ignore - 古いフィールドへのアクセス
      if (!inv.type || inv.type === '') {
        await prisma.$executeRaw`
          UPDATE Invitation
          SET type = 'organization'
          WHERE id = ${inv.id} AND (type IS NULL OR type = '')
        `;
        updatedCount++;
      }
    } catch (e) {
      // フィールドが存在しない場合は無視
    }
  }

  console.log(`  更新した招待: ${updatedCount}件`);

  // 6. 統計情報を表示
  console.log('\n=== マイグレーション完了 ===');

  const stats = {
    organizations: await prisma.organization.count(),
    teams: await prisma.team.count(),
    teamMembers: await prisma.teamMember.count(),
    recordings: await prisma.recording.count(),
    recordingsWithTeam: await prisma.recording.count({ where: { teamId: { not: null } } }),
  };

  console.log('\n統計情報:');
  console.log(`  組織数: ${stats.organizations}`);
  console.log(`  チーム数: ${stats.teams}`);
  console.log(`  チームメンバー数: ${stats.teamMembers}`);
  console.log(`  録画数: ${stats.recordings}`);
  console.log(`  チーム紐付け済み録画: ${stats.recordingsWithTeam}`);
}

main()
  .catch((e) => {
    console.error('マイグレーションエラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
