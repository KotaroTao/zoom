'use client';

import { useState, useEffect } from 'react';
import { Video, CheckCircle, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ActionRequired } from '@/components/ActionRequired';
import { TodaysMeetings } from '@/components/TodaysMeetings';
import { api, DashboardData, Client } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [dashboardData, clientsData] = await Promise.all([
        api.getDashboard(),
        api.getClients(),
      ]);
      setData(dashboardData);
      setClients(clientsData.clients);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 30秒ごとに更新
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>読み込み中...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-gray-500 mt-1">Zoom録画の処理状況を確認</p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* ミニ統計 */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white rounded-lg shadow px-4 py-2">
            <Video className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600">総録画数</span>
            <span className="font-bold text-lg">{data?.stats.totalRecordings || 0}</span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-lg shadow px-4 py-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600">処理完了</span>
            <span className="font-bold text-lg">{data?.stats.completedCount || 0}</span>
            <span className="text-sm text-gray-500">({data?.stats.completionRate || 0}%)</span>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="space-y-6">
          {/* 対応が必要セクション */}
          {data && (
            <ActionRequired
              failed={data.actionItems.failed}
              noClient={data.actionItems.noClient}
              noSummary={data.actionItems.noSummary}
              clients={clients}
              onUpdate={fetchData}
            />
          )}

          {/* 今日のミーティング */}
          {data && (
            <TodaysMeetings recordings={data.todaysRecordings} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
