-- 組織必須化マイグレーション
-- 注意: このマイグレーションは既存のrecordingsデータがある場合、organizationIdがnullのレコードを削除します

-- 1. Userテーブルから個人モード関連のカラムを削除
-- SQLiteではカラム削除に制限があるため、テーブル再作成が必要
-- ただし、isPersonalModeカラムは残しても害はないため、スキップ可能

-- 2. Recordingテーブルの再作成（organizationId必須化）

-- organizationIdがnullのレコードを削除（存在する場合）
DELETE FROM "Recording" WHERE "organizationId" IS NULL;

-- 新しいテーブルを作成
CREATE TABLE "Recording_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT,
    "zoomMeetingId" TEXT NOT NULL,
    "zoomMeetingUuid" TEXT,
    "title" TEXT NOT NULL,
    "hostEmail" TEXT,
    "duration" INTEGER,
    "meetingDate" DATETIME NOT NULL,
    "zoomUrl" TEXT NOT NULL,
    "clientName" TEXT,
    "youtubeVideoId" TEXT,
    "youtubeUrl" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "detailedSummary" TEXT,
    "detailedSummaryStatus" TEXT,
    "clientReport" TEXT,
    "clientReportTemplateId" TEXT,
    "clientReportGeneratedAt" DATETIME,
    "reportSentAt" DATETIME,
    "sheetRowNumber" INTEGER,
    "notionPageId" TEXT,
    "youtubeSuccess" BOOLEAN,
    "sheetsSuccess" BOOLEAN,
    "notionSuccess" BOOLEAN,
    "sheetsError" TEXT,
    "notionError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "downloadedAt" DATETIME,
    "uploadedAt" DATETIME,
    "transcribedAt" DATETIME,
    "summarizedAt" DATETIME,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recording_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recording_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- データをコピー
INSERT INTO "Recording_new" SELECT
    "id",
    "organizationId",
    "teamId",
    "zoomMeetingId",
    "zoomMeetingUuid",
    "title",
    "hostEmail",
    "duration",
    "meetingDate",
    "zoomUrl",
    "clientName",
    "youtubeVideoId",
    "youtubeUrl",
    "transcript",
    "summary",
    "detailedSummary",
    "detailedSummaryStatus",
    "clientReport",
    "clientReportTemplateId",
    "clientReportGeneratedAt",
    "reportSentAt",
    "sheetRowNumber",
    "notionPageId",
    "youtubeSuccess",
    "sheetsSuccess",
    "notionSuccess",
    "sheetsError",
    "notionError",
    "status",
    "errorMessage",
    "downloadedAt",
    "uploadedAt",
    "transcribedAt",
    "summarizedAt",
    "syncedAt",
    "createdAt",
    "updatedAt"
FROM "Recording";

-- 古いテーブルを削除
DROP TABLE "Recording";

-- 新しいテーブルをリネーム
ALTER TABLE "Recording_new" RENAME TO "Recording";

-- インデックスを再作成
CREATE UNIQUE INDEX "Recording_organizationId_zoomMeetingId_key" ON "Recording"("organizationId", "zoomMeetingId");
CREATE INDEX "Recording_organizationId_idx" ON "Recording"("organizationId");
CREATE INDEX "Recording_teamId_idx" ON "Recording"("teamId");
CREATE INDEX "Recording_clientName_idx" ON "Recording"("clientName");
CREATE INDEX "Recording_status_idx" ON "Recording"("status");
CREATE INDEX "Recording_meetingDate_idx" ON "Recording"("meetingDate");

-- Userテーブルからカラム削除（SQLiteの制限により、新規テーブル作成が必要だが、
-- isPersonalModeカラムは残しても問題ないため、ここではスキップ）
-- 必要に応じて以下のコメントを解除してUserテーブルも再作成可能
