import { Video, Users, Clock, CheckCircle } from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { RecentRecordings } from '@/components/RecentRecordings';
import { ClientList } from '@/components/ClientList';
import { QueueStatus } from '@/components/QueueStatus';

export default function DashboardPage() {
  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-500 mt-1">Zoom録画の処理状況を確認</p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="総録画数"
          value="24"
          icon={Video}
          color="blue"
          change="+3 今週"
        />
        <StatsCard
          title="クライアント数"
          value="8"
          icon={Users}
          color="green"
          change="+1 新規"
        />
        <StatsCard
          title="総録画時間"
          value="48時間"
          icon={Clock}
          color="purple"
          change="+5h 今週"
        />
        <StatsCard
          title="処理完了"
          value="22"
          icon={CheckCircle}
          color="emerald"
          change="92%"
        />
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 最近の録画 */}
        <div className="lg:col-span-2">
          <RecentRecordings />
        </div>

        {/* サイドパネル */}
        <div className="space-y-6">
          {/* 処理キュー */}
          <QueueStatus />

          {/* クライアント一覧 */}
          <ClientList />
        </div>
      </div>
    </div>
  );
}
