'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Search,
  Filter,
  Play,
  ExternalLink,
  FileText,
  Download,
  Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, Recording } from '@/lib/api';

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    const fetchRecordings = async () => {
      setLoading(true);
      try {
        const data = await api.getRecordings({
          limit,
          offset: page * limit,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        });
        setRecordings(data.recordings);
        setTotal(data.total);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch recordings:', err);
        setError('録画の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, [page, statusFilter]);

  // クライアント側でのテキスト検索フィルター
  const filteredRecordings = recordings.filter((recording) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      recording.title.toLowerCase().includes(query) ||
      recording.clientName?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">録画一覧</h1>
          <p className="text-gray-500 mt-1">すべてのZoom録画を確認</p>
        </div>

      {/* フィルター */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 検索 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="タイトルまたはクライアント名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* ステータスフィルター */}
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">すべて</option>
                <option value="COMPLETED">完了</option>
                <option value="TRANSCRIBING">文字起こし中</option>
                <option value="UPLOADING">アップロード中</option>
                <option value="DOWNLOADING">ダウンロード中</option>
                <option value="PENDING">待機中</option>
                <option value="FAILED">失敗</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 録画リスト */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      タイトル
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      クライアント
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      日時
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      時間
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ステータス
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecordings.map((recording) => (
                    <tr key={recording.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <Play className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {recording.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {recording.clientName ? (
                          <Link
                            href={`/clients/${encodeURIComponent(recording.clientName)}`}
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            {recording.clientName}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {format(new Date(recording.meetingDate), 'yyyy/M/d HH:mm', {
                          locale: ja,
                        })}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {recording.duration ? `${recording.duration}分` : '-'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={recording.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end space-x-1">
                          {recording.youtubeUrl && (
                            <a
                              href={recording.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg"
                              title="YouTubeで見る"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {recording.summary && (
                            <button
                              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                              title="要約を表示"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {recording.zoomUrl && (
                            <a
                              href={recording.zoomUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-lg"
                              title="Zoomで見る"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 結果なし */}
            {filteredRecordings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">該当する録画が見つかりません</p>
              </div>
            )}

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  全{total}件中 {page * limit + 1}-{Math.min((page + 1) * limit, total)}件を表示
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}
