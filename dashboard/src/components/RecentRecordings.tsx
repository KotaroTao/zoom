'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Play, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { getRecordings, type Recording } from '@/lib/api';

export function RecentRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const data = await getRecordings({ limit: 10, sortBy: 'meetingDate', sortOrder: 'desc' });
      setRecordings(data.recordings);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recordings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
    // 30秒ごとに更新
    const interval = setInterval(fetchRecordings, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">最近の録画</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecordings}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="更新"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/recordings"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            すべて表示 →
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 text-red-600 text-sm">{error}</div>
      )}

      {loading && recordings.length === 0 ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          録画がありません
        </div>
      ) : (
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
                  <td className="px-4 py-3">
                    <Link href={`/recordings/${recording.id}`} className="flex items-center group">
                      <Play className="h-4 w-4 text-gray-400 mr-2 group-hover:text-primary-600" />
                      <span className="text-sm font-medium text-gray-900 group-hover:text-primary-600">
                        {recording.title}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {format(new Date(recording.meetingDate), 'M/d HH:mm', {
                      locale: ja,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={recording.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {recording.youtubeUrl && (
                        <a
                          href={recording.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="YouTubeで見る"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Link
                        href={`/recordings/${recording.id}`}
                        className="p-1 text-gray-400 hover:text-primary-600"
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
      )}
    </div>
  );
}
