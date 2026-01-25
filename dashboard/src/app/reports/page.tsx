'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MessageSquare,
  TrendingUp,
  Users,
  ChevronDown,
  Loader2,
  FileText,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

interface ReportData {
  period: {
    start: string;
    end: string;
    label: string;
    type: string;
  };
  summary: {
    totalMeetings: number;
    totalDuration: number;
    totalDurationFormatted: string;
    newActionItems: number;
    completedActionItems: number;
    overdueActionItems: number;
  };
  byClient: Array<{
    client: { id: string; name: string; color: string | null } | null;
    meetingCount: number;
    totalDuration: number;
    totalDurationFormatted: string;
    actionItems: { total: number; completed: number; pending: number; overdue: number };
  }>;
  meetings: Array<{
    id: string;
    name: string;
    date: string;
    duration: number | null;
    durationFormatted: string | null;
    client: { id: string; name: string; color: string | null } | null;
    actionItemsCount: number;
    actionItemsCompleted: number;
  }>;
  clients: Array<{ id: string; name: string; color: string | null }>;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [clientFilter, setClientFilter] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('period', period);
      if (clientFilter) params.set('clientId', clientFilter);

      const res = await fetch(`/api/reports?${params}`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  }, [period, clientFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (loading || !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">レポート</h1>
            <p className="text-gray-500 mt-1">ミーティングとタスクの集計</p>
          </div>

          {/* 期間選択 */}
          <div className="flex items-center gap-4">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setPeriod('weekly')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  period === 'weekly'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                週次
              </button>
              <button
                onClick={() => setPeriod('monthly')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  period === 'monthly'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                月次
              </button>
            </div>

            {/* クライアントフィルタ */}
            <div className="relative">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="appearance-none pl-10 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">すべてのクライアント</option>
                {data.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* 期間表示 */}
        <div className="mb-6 px-4 py-2 bg-gray-100 rounded-lg inline-flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-700">{data.period.label}</span>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <MessageSquare className="h-4 w-4" />
              ミーティング数
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.summary.totalMeetings}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Clock className="h-4 w-4" />
              合計時間
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.summary.totalDurationFormatted || '0分'}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <CheckCircle2 className="h-4 w-4" />
              完了タスク
            </div>
            <p className="text-3xl font-bold text-green-600">
              {data.summary.completedActionItems}
              <span className="text-lg text-gray-400">/{data.summary.newActionItems}</span>
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <AlertTriangle className="h-4 w-4" />
              期限切れ
            </div>
            <p className={`text-3xl font-bold ${data.summary.overdueActionItems > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {data.summary.overdueActionItems}
            </p>
          </div>
        </div>

        {/* クライアント別サマリー */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">クライアント別サマリー</h2>
          {data.byClient.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Building2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">データがありません</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {data.byClient.map((item, index) => (
                <div
                  key={item.client?.id || 'none'}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.client?.color || '#9ca3af' }}
                      />
                      <span className="font-medium text-gray-900">
                        {item.client?.name || '未分類'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {item.meetingCount}件のミーティング
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">合計時間</span>
                      <p className="font-medium">{item.totalDurationFormatted || '0分'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">タスク</span>
                      <p className="font-medium">{item.actionItems.total}件</p>
                    </div>
                    <div>
                      <span className="text-gray-500">完了</span>
                      <p className="font-medium text-green-600">{item.actionItems.completed}件</p>
                    </div>
                    <div>
                      <span className="text-gray-500">期限切れ</span>
                      <p className={`font-medium ${item.actionItems.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.actionItems.overdue}件
                      </p>
                    </div>
                  </div>

                  {/* プログレスバー */}
                  {item.actionItems.total > 0 && (
                    <div className="mt-3">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{
                            width: `${(item.actionItems.completed / item.actionItems.total) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round((item.actionItems.completed / item.actionItems.total) * 100)}% 完了
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ミーティング一覧 */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">ミーティング一覧</h2>
          {data.meetings.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">ミーティングがありません</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">ミーティング</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">クライアント</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">日時</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">時間</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">タスク</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.meetings.map((meeting) => (
                    <tr key={meeting.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/circleback/${meeting.id}`}
                          className="text-gray-900 hover:text-primary-600 font-medium"
                        >
                          {meeting.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {meeting.client ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor: meeting.client.color ? `${meeting.client.color}20` : '#f3f4f6',
                              color: meeting.client.color || '#6b7280',
                            }}
                          >
                            {meeting.client.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(meeting.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{meeting.durationFormatted || '-'}</td>
                      <td className="px-4 py-3">
                        {meeting.actionItemsCount > 0 ? (
                          <span className="text-sm">
                            <span className="text-green-600 font-medium">{meeting.actionItemsCompleted}</span>
                            <span className="text-gray-400">/{meeting.actionItemsCount}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
