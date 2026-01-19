'use client';

import { useState, useEffect } from 'react';
import { Video, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import { RecentRecordings } from '@/components/RecentRecordings';
import { ClientList } from '@/components/ClientList';
import { QueueStatus } from '@/components/QueueStatus';
import { getStats, type Stats } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getStats();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // 30秒ごとに更新
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // 時間をフォーマット
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}分`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
  };

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-gray-500 mt-1">Zoom録画の処理状況を確認</p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="総録画数"
          value={loading ? '-' : String(stats?.totalRecordings || 0)}
          icon={Video}
          color="blue"
          change={loading ? '' : `+${stats?.thisWeekRecordings || 0} 今週`}
        />
        <StatsCard
          title="クライアント数"
          value={loading ? '-' : String(stats?.totalClients || 0)}
          icon={Users}
          color="green"
        />
        <StatsCard
          title="総録画時間"
          value={loading ? '-' : formatDuration(stats?.totalDurationMinutes || 0)}
          icon={Clock}
          color="purple"
        />
        <StatsCard
          title="処理完了"
          value={loading ? '-' : String(stats?.completedRecordings || 0)}
          icon={CheckCircle}
          color="emerald"
          change={loading ? '' : `${stats?.completionRate || 0}%`}
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
