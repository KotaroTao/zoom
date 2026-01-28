/**
 * SQLite → PostgreSQL データ移行スクリプト
 *
 * 使用方法:
 * 1. PostgreSQLをインストール・設定
 * 2. .envのDATABASE_URLをPostgreSQLに変更
 * 3. npx prisma db push（PostgreSQLにスキーマ作成）
 * 4. SQLITE_URL=file:./path/to/data.db npx tsx scripts/migrate-to-postgres.ts
 *
 * 注意:
 * - detailedSummary, detailedSummaryStatus は移行しない（削除予定）
 * - circlebackActionItems は PostgreSQLではJson型、SQLiteでは存在しない
 */

import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';

// SQLite接続（環境変数またはデフォルトパス）
const sqlitePath = process.env.SQLITE_URL?.replace('file:', '') || './dashboard/prisma/data.db';

interface SqliteRow {
  [key: string]: unknown;
}

async function migrate() {
  console.log('='.repeat(50));
  console.log('SQLite → PostgreSQL データ移行開始');
  console.log('='.repeat(50));
  console.log(`SQLite: ${sqlitePath}`);
  console.log(`PostgreSQL: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
  console.log('');

  // SQLite接続
  const sqlite = new Database(sqlitePath, { readonly: true });

  // PostgreSQL接続
  const postgres = new PrismaClient();

  try {
    // 移行順序（外部キー制約を考慮）
    // 1. Organization（親テーブル）
    // 2. User（親テーブル）
    // 3. OrganizationMember（Organization, User に依存）
    // 4. Settings（Organization に依存）
    // 5. Client（Organization に依存）
    // 6. ClientContact（Client に依存）
    // 7. Recording（Organization に依存）
    // 8. ReportTemplate（Organization に依存）
    // 9. Invitation（Organization, User に依存）
    // 10. ProcessLog（独立）

    // 1. Organization
    console.log('1/10 Organization を移行中...');
    const organizations = sqlite.prepare('SELECT * FROM Organization').all() as SqliteRow[];
    for (const org of organizations) {
      await postgres.organization.create({
        data: {
          id: org.id as string,
          name: org.name as string,
          slug: org.slug as string,
          plan: org.plan as string || 'free',
          maxMembers: org.maxMembers as number || 5,
          maxRecordings: org.maxRecordings as number || 100,
          createdAt: new Date(org.createdAt as string),
          updatedAt: new Date(org.updatedAt as string),
        },
      });
    }
    console.log(`   → ${organizations.length} 件完了`);

    // 2. User
    console.log('2/10 User を移行中...');
    const users = sqlite.prepare('SELECT * FROM User').all() as SqliteRow[];
    for (const user of users) {
      await postgres.user.create({
        data: {
          id: user.id as string,
          email: user.email as string,
          name: user.name as string | null,
          passwordHash: user.passwordHash as string | null,
          image: user.image as string | null,
          googleId: user.googleId as string | null,
          emailVerified: user.emailVerified ? new Date(user.emailVerified as string) : null,
          createdAt: new Date(user.createdAt as string),
          updatedAt: new Date(user.updatedAt as string),
        },
      });
    }
    console.log(`   → ${users.length} 件完了`);

    // 3. OrganizationMember
    console.log('3/10 OrganizationMember を移行中...');
    const members = sqlite.prepare('SELECT * FROM OrganizationMember').all() as SqliteRow[];
    for (const member of members) {
      await postgres.organizationMember.create({
        data: {
          id: member.id as string,
          role: member.role as string || 'member',
          userId: member.userId as string,
          organizationId: member.organizationId as string,
          createdAt: new Date(member.createdAt as string),
          updatedAt: new Date(member.updatedAt as string),
        },
      });
    }
    console.log(`   → ${members.length} 件完了`);

    // 4. Settings
    console.log('4/10 Settings を移行中...');
    const settings = sqlite.prepare('SELECT * FROM Settings').all() as SqliteRow[];
    for (const setting of settings) {
      await postgres.settings.create({
        data: {
          id: setting.id as string,
          organizationId: setting.organizationId as string,
          youtubeEnabled: Boolean(setting.youtubeEnabled),
          youtubePrivacy: setting.youtubePrivacy as string || 'unlisted',
          sheetsEnabled: Boolean(setting.sheetsEnabled),
          notionEnabled: Boolean(setting.notionEnabled),
          // Circleback（新規、デフォルト値）
          circlebackEnabled: false,
          circlebackWebhookSecret: null,
          // API認証情報
          zoomAccountId: setting.zoomAccountId as string | null,
          zoomClientId: setting.zoomClientId as string | null,
          zoomClientSecret: setting.zoomClientSecret as string | null,
          zoomWebhookSecretToken: setting.zoomWebhookSecretToken as string | null,
          openaiApiKey: setting.openaiApiKey as string | null,
          googleClientId: setting.googleClientId as string | null,
          googleClientSecret: setting.googleClientSecret as string | null,
          googleRefreshToken: setting.googleRefreshToken as string | null,
          googleSpreadsheetId: setting.googleSpreadsheetId as string | null,
          notionApiKey: setting.notionApiKey as string | null,
          notionDatabaseId: setting.notionDatabaseId as string | null,
          createdAt: new Date(setting.createdAt as string),
          updatedAt: new Date(setting.updatedAt as string),
        },
      });
    }
    console.log(`   → ${settings.length} 件完了`);

    // 5. Client
    console.log('5/10 Client を移行中...');
    const clients = sqlite.prepare('SELECT * FROM Client').all() as SqliteRow[];
    for (const client of clients) {
      await postgres.client.create({
        data: {
          id: client.id as string,
          organizationId: client.organizationId as string,
          name: client.name as string,
          description: client.description as string | null,
          color: client.color as string | null,
          zoomUrl: client.zoomUrl as string | null,
          contactUrl: client.contactUrl as string | null,
          contactType: client.contactType as string | null,
          isActive: Boolean(client.isActive),
          createdAt: new Date(client.createdAt as string),
          updatedAt: new Date(client.updatedAt as string),
        },
      });
    }
    console.log(`   → ${clients.length} 件完了`);

    // 6. ClientContact
    console.log('6/10 ClientContact を移行中...');
    const contacts = sqlite.prepare('SELECT * FROM ClientContact').all() as SqliteRow[];
    for (const contact of contacts) {
      await postgres.clientContact.create({
        data: {
          id: contact.id as string,
          clientId: contact.clientId as string,
          type: contact.type as string,
          url: contact.url as string,
          label: contact.label as string | null,
          sortOrder: contact.sortOrder as number || 0,
          createdAt: new Date(contact.createdAt as string),
          updatedAt: new Date(contact.updatedAt as string),
        },
      });
    }
    console.log(`   → ${contacts.length} 件完了`);

    // 7. Recording（detailedSummary, detailedSummaryStatus は移行しない）
    console.log('7/10 Recording を移行中...');
    const recordings = sqlite.prepare('SELECT * FROM Recording').all() as SqliteRow[];
    for (const rec of recordings) {
      // ステータスの変換（TRANSCRIBING, SUMMARIZING → WAITING_CIRCLEBACK）
      let status = rec.status as string;
      if (status === 'TRANSCRIBING' || status === 'SUMMARIZING') {
        status = 'WAITING_CIRCLEBACK';
      }

      await postgres.recording.create({
        data: {
          id: rec.id as string,
          organizationId: rec.organizationId as string,
          zoomMeetingId: rec.zoomMeetingId as string,
          zoomMeetingUuid: rec.zoomMeetingUuid as string | null,
          title: rec.title as string,
          hostEmail: rec.hostEmail as string | null,
          duration: rec.duration as number | null,
          meetingDate: new Date(rec.meetingDate as string),
          zoomUrl: rec.zoomUrl as string,
          clientName: rec.clientName as string | null,
          youtubeVideoId: rec.youtubeVideoId as string | null,
          youtubeUrl: rec.youtubeUrl as string | null,
          transcript: rec.transcript as string | null,
          summary: rec.summary as string | null,
          // detailedSummary, detailedSummaryStatus は移行しない
          // Circleback（新規、デフォルト値）
          circlebackMeetingId: null,
          circlebackNotes: null,
          circlebackActionItems: null,
          circlebackRecordingUrl: null,
          circlebackSyncedAt: null,
          // クライアント向け報告書
          clientReport: rec.clientReport as string | null,
          clientReportTemplateId: rec.clientReportTemplateId as string | null,
          clientReportGeneratedAt: rec.clientReportGeneratedAt
            ? new Date(rec.clientReportGeneratedAt as string)
            : null,
          reportSentAt: rec.reportSentAt ? new Date(rec.reportSentAt as string) : null,
          // 外部連携
          sheetRowNumber: rec.sheetRowNumber as number | null,
          notionPageId: rec.notionPageId as string | null,
          // 同期ステータス
          youtubeSuccess: rec.youtubeSuccess === null ? null : Boolean(rec.youtubeSuccess),
          sheetsSuccess: rec.sheetsSuccess === null ? null : Boolean(rec.sheetsSuccess),
          notionSuccess: rec.notionSuccess === null ? null : Boolean(rec.notionSuccess),
          sheetsError: rec.sheetsError as string | null,
          notionError: rec.notionError as string | null,
          // ステータス
          status,
          errorMessage: rec.errorMessage as string | null,
          // 処理時刻
          downloadedAt: rec.downloadedAt ? new Date(rec.downloadedAt as string) : null,
          uploadedAt: rec.uploadedAt ? new Date(rec.uploadedAt as string) : null,
          transcribedAt: rec.transcribedAt ? new Date(rec.transcribedAt as string) : null,
          summarizedAt: rec.summarizedAt ? new Date(rec.summarizedAt as string) : null,
          syncedAt: rec.syncedAt ? new Date(rec.syncedAt as string) : null,
          createdAt: new Date(rec.createdAt as string),
          updatedAt: new Date(rec.updatedAt as string),
        },
      });
    }
    console.log(`   → ${recordings.length} 件完了`);

    // 8. ReportTemplate
    console.log('8/10 ReportTemplate を移行中...');
    const templates = sqlite.prepare('SELECT * FROM ReportTemplate').all() as SqliteRow[];
    for (const template of templates) {
      await postgres.reportTemplate.create({
        data: {
          id: template.id as string,
          organizationId: template.organizationId as string,
          name: template.name as string,
          description: template.description as string | null,
          content: template.content as string,
          isDefault: Boolean(template.isDefault),
          isActive: Boolean(template.isActive),
          createdAt: new Date(template.createdAt as string),
          updatedAt: new Date(template.updatedAt as string),
        },
      });
    }
    console.log(`   → ${templates.length} 件完了`);

    // 9. Invitation
    console.log('9/10 Invitation を移行中...');
    const invitations = sqlite.prepare('SELECT * FROM Invitation').all() as SqliteRow[];
    for (const inv of invitations) {
      await postgres.invitation.create({
        data: {
          id: inv.id as string,
          email: inv.email as string,
          role: inv.role as string || 'member',
          token: inv.token as string,
          expiresAt: new Date(inv.expiresAt as string),
          invitedById: inv.invitedById as string,
          organizationId: inv.organizationId as string,
          createdAt: new Date(inv.createdAt as string),
        },
      });
    }
    console.log(`   → ${invitations.length} 件完了`);

    // 10. ProcessLog
    console.log('10/10 ProcessLog を移行中...');
    const logs = sqlite.prepare('SELECT * FROM ProcessLog').all() as SqliteRow[];
    for (const log of logs) {
      await postgres.processLog.create({
        data: {
          id: log.id as string,
          recordingId: log.recordingId as string,
          step: log.step as string,
          status: log.status as string,
          message: log.message as string | null,
          duration: log.duration as number | null,
          createdAt: new Date(log.createdAt as string),
        },
      });
    }
    console.log(`   → ${logs.length} 件完了`);

    console.log('');
    console.log('='.repeat(50));
    console.log('データ移行完了！');
    console.log('='.repeat(50));
    console.log('');
    console.log('移行サマリー:');
    console.log(`  Organization: ${organizations.length}`);
    console.log(`  User: ${users.length}`);
    console.log(`  OrganizationMember: ${members.length}`);
    console.log(`  Settings: ${settings.length}`);
    console.log(`  Client: ${clients.length}`);
    console.log(`  ClientContact: ${contacts.length}`);
    console.log(`  Recording: ${recordings.length}`);
    console.log(`  ReportTemplate: ${templates.length}`);
    console.log(`  Invitation: ${invitations.length}`);
    console.log(`  ProcessLog: ${logs.length}`);
    console.log('');
    console.log('注意: detailedSummary, detailedSummaryStatus は移行されていません');
  } catch (error) {
    console.error('移行エラー:', error);
    throw error;
  } finally {
    sqlite.close();
    await postgres.$disconnect();
  }
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
