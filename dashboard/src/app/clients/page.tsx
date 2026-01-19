'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Users, Video, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, Client } from '@/lib/api';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await api.getClients();
        setClients(data.clients);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch clients:', err);
        setError('クライアントの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const totalRecordings = clients.reduce((acc, c) => acc + c.recordingCount, 0);
  const totalDuration = clients.reduce((acc, c) => acc + c.totalDuration, 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">クライアント一覧</h1>
            <p className="text-gray-500 mt-1">クライアント別のミーティング履歴を確認</p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">クライアント一覧</h1>
        <p className="text-gray-500 mt-1">
          クライアント別のミーティング履歴を確認
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">総クライアント数</p>
              <p className="text-xl font-bold text-gray-900">
                {clients.length}社
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-green-50 rounded-lg mr-3">
              <Video className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">総録画数</p>
              <p className="text-xl font-bold text-gray-900">
                {totalRecordings}件
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg mr-3">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">総時間</p>
              <p className="text-xl font-bold text-gray-900">
                {Math.round(totalDuration / 60)}時間
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* クライアントリスト */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">クライアント</h2>
        </div>
        {clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            クライアントがまだありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    クライアント名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    録画数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    総時間
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    最終MTG
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.name} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 font-medium">
                            {client.name.charAt(0)}
                          </span>
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {client.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {client.recordingCount}件
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {Math.floor(client.totalDuration / 60)}時間
                        {client.totalDuration % 60}分
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {client.lastMeetingDate
                          ? format(new Date(client.lastMeetingDate), 'yyyy/M/d', {
                              locale: ja,
                            })
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/clients/${encodeURIComponent(client.name)}`}
                        className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                      >
                        詳細
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
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
