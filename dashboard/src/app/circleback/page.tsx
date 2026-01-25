'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Clock,
  Users,
  CheckSquare,
  ChevronRight,
  Search,
  Loader2,
  AlertCircle,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, CirclebackMeeting } from '@/lib/api';

export default function CirclebackPage() {
  const [meetings, setMeetings] = useState<CirclebackMeeting[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        const data = await api.getCirclebackMeetings({
          limit,
          offset: page * limit,
          search: search || undefined,
        });
        setMeetings(data.meetings);
        setTotal(data.total);
      } catch (err) {
        console.error('Failed to fetch circleback meetings:', err);
        setError('Circlebackミーティングの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, [page, search]);

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    }
    return `${minutes}分`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && meetings.length === 0) {
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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-indigo-500" />
              Circlebackミーティング
            </h1>
            <p className="text-gray-500 mt-1">AIミーティングノートの一覧</p>
          </div>
          <div className="text-sm text-gray-500">
            {total}件のミーティング
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* 検索 */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="ミーティング名やノートで検索..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* ミーティング一覧 */}
        {meetings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Circlebackミーティングはまだありません</p>
            <p className="text-sm mt-2">
              Circlebackを設定すると、ミーティングノートが自動的に同期されます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <a
                key={meeting.id}
                href={`/zoom/circleback/${meeting.id}`}
                className="block card p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {meeting.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(meeting.circlebackCreatedAt)}
                      </span>
                      {meeting.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(meeting.duration)}
                        </span>
                      )}
                      {meeting.attendees && meeting.attendees.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {meeting.attendees.length}人
                        </span>
                      )}
                      {(meeting.actionItemCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <CheckSquare className="h-4 w-4" />
                          {meeting.actionItemCount}件のアクション
                        </span>
                      )}
                    </div>
                    {meeting.notes && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                        {meeting.notes.substring(0, 200)}...
                      </p>
                    )}
                    {meeting.tags && meeting.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {meeting.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                </div>
              </a>
            ))}
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              前へ
            </button>
            <span className="text-sm text-gray-600">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
