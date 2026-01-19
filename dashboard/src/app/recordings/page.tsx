'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Search,
  Filter,
  Play,
  ExternalLink,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { getRecordings, type Recording } from '@/lib/api';

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchRecordings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRecordings({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        sortBy: 'meetingDate',
        sortOrder: 'desc',
      });
      setRecordings(data.recordings);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recordings');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, searchQuery]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // 検索・フィルター変更時はページをリセット
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchQuery, statusFilter]);

  return (
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
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">すべて</option>
                <option value="COMPLETED">完了</option>
                <option value="TRANSCRIBING">文字起こし中</option>
                <option value="UPLOADING">アップロード中</option>
                <option value="PENDING">待機中</option>
                <option value="FAILED">失敗</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="card mb-6 bg-red-50 border-red-200">
          <div className="card-body text-red-700">{error}</div>
        </div>
      )}

      {/* 録画リスト */}
      <div className="card">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
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
                  {recordings.map((recording) => (
                    <tr key={recording.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <Link
                          href={`/recordings/${recording.id}`}
                          className="flex items-center group"
                        >
                          <Play className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 group-hover:text-primary-600" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs group-hover:text-primary-600">
                            {recording.title}
                          </span>
                        </Link>
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
                          <Link
                            href={`/recordings/${recording.id}`}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                            title="詳細を表示"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 結果なし */}
            {recordings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">該当する録画が見つかりません</p>
              </div>
            )}

            {/* ページネーション */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}〜
                  {Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                    }
                    disabled={pagination.page === 1}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                    }
                    disabled={pagination.page === pagination.totalPages}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
