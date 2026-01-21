'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Play, ExternalLink, FileText, Loader2, X, Youtube } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { api, Recording } from '@/lib/api';

export function RecentRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const data = await api.getRecordings({ limit: 5 });
        setRecordings(data.recordings);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch recordings:', err);
        setError('録画の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
    // 30秒ごとに更新
    const interval = setInterval(fetchRecordings, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最近の録画</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最近の録画</h2>
        </div>
        <div className="p-4 text-center text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">最近の録画</h2>
        <Link
          href="/recordings"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          すべて表示 →
        </Link>
      </div>
      {recordings.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          録画がまだありません
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
                    <div className="flex items-center">
                      <Play className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {recording.title}
                      </span>
                    </div>
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
                      {recording.summary && (
                        <button
                          onClick={() => setSelectedRecording(recording)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title="要約を表示"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 要約モーダル */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedRecording.title}
              </h3>
              <button
                onClick={() => setSelectedRecording(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="text-sm text-gray-500 mb-3">
                {format(new Date(selectedRecording.meetingDate), 'yyyy年M月d日 HH:mm', { locale: ja })}
                {selectedRecording.clientName && ` • ${selectedRecording.clientName}`}
              </div>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedRecording.summary}
                </pre>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              {selectedRecording.youtubeUrl && (
                <a
                  href={selectedRecording.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                >
                  <Youtube className="h-4 w-4" />
                  YouTube
                </a>
              )}
              <button
                onClick={() => setSelectedRecording(null)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
