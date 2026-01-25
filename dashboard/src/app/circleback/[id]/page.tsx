'use client';

import { useState, useEffect, use } from 'react';
import {
  MessageSquare,
  Clock,
  Users,
  CheckSquare,
  Square,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  Video,
  FileText,
  Tag,
  Trash2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api, CirclebackMeeting, CirclebackActionItem } from '@/lib/api';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

export default function CirclebackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [meeting, setMeeting] = useState<CirclebackMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript' | 'actions'>('notes');
  const [updatingActionItem, setUpdatingActionItem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        setLoading(true);
        const data = await api.getCirclebackMeeting(id);
        setMeeting(data);
      } catch (err) {
        console.error('Failed to fetch meeting:', err);
        setError('ミーティングの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
  }, [id]);

  const handleToggleActionItem = async (actionItem: CirclebackActionItem) => {
    if (!meeting) return;
    setUpdatingActionItem(actionItem.id);
    try {
      const newStatus = actionItem.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      await api.updateCirclebackActionItem(meeting.id, actionItem.id, newStatus);
      setMeeting((prev) => {
        if (!prev || !prev.actionItems) return prev;
        return {
          ...prev,
          actionItems: prev.actionItems.map((item) =>
            item.id === actionItem.id ? { ...item, status: newStatus } : item
          ),
        };
      });
    } catch (err) {
      console.error('Failed to update action item:', err);
    } finally {
      setUpdatingActionItem(null);
    }
  };

  const handleDelete = async () => {
    if (!meeting || !confirm('このミーティングを削除しますか？')) return;
    setDeleting(true);
    try {
      await api.deleteCirclebackMeeting(meeting.id);
      router.push('/zoom/circleback');
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      setError('ミーティングの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !meeting) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error || 'ミーティングが見つかりません'}
          </div>
          <a
            href="/zoom/circleback"
            className="inline-flex items-center gap-2 mt-4 text-primary-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            一覧に戻る
          </a>
        </div>
      </DashboardLayout>
    );
  }

  const completedActions = meeting.actionItems?.filter((a) => a.status === 'COMPLETED').length || 0;
  const totalActions = meeting.actionItems?.length || 0;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl">
        {/* 戻るリンク */}
        <a
          href="/zoom/circleback"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          一覧に戻る
        </a>

        {/* ヘッダー */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-indigo-500" />
                {meeting.name}
              </h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
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
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="削除"
            >
              {deleting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* 参加者 */}
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                参加者 ({meeting.attendees.length}人)
              </h3>
              <div className="flex flex-wrap gap-2">
                {meeting.attendees.map((attendee, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded"
                    title={attendee.email}
                  >
                    {attendee.name || attendee.email}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* タグ */}
          {meeting.tags && meeting.tags.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4" />
                タグ
              </h3>
              <div className="flex flex-wrap gap-2">
                {meeting.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-sm bg-indigo-100 text-indigo-700 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 録画リンク */}
          {meeting.recordingUrl && (
            <div className="mt-4 pt-4 border-t">
              <a
                href={meeting.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-600 hover:underline"
              >
                <Video className="h-4 w-4" />
                録画を見る
              </a>
              <p className="text-xs text-gray-500 mt-1">
                録画リンクは24時間のみ有効です
              </p>
            </div>
          )}
        </div>

        {/* タブ */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'notes'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-1" />
              ノート
            </button>
            {meeting.transcript && (
              <button
                onClick={() => setActiveTab('transcript')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'transcript'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="h-4 w-4 inline mr-1" />
                文字起こし
              </button>
            )}
            {totalActions > 0 && (
              <button
                onClick={() => setActiveTab('actions')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'actions'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CheckSquare className="h-4 w-4 inline mr-1" />
                アクションアイテム ({completedActions}/{totalActions})
              </button>
            )}
          </nav>
        </div>

        {/* コンテンツ */}
        <div className="card p-6">
          {activeTab === 'notes' && (
            <div className="prose prose-sm max-w-none">
              {meeting.notes ? (
                <ReactMarkdown>{meeting.notes}</ReactMarkdown>
              ) : (
                <p className="text-gray-500">ノートはありません</p>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="whitespace-pre-wrap text-sm text-gray-700">
              {meeting.transcript || 'テキストなし'}
            </div>
          )}

          {activeTab === 'actions' && meeting.actionItems && (
            <div className="space-y-3">
              {meeting.actionItems.map((action) => (
                <div
                  key={action.id}
                  className={`p-4 rounded-lg border ${
                    action.status === 'COMPLETED'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleActionItem(action)}
                      disabled={updatingActionItem === action.id}
                      className="flex-shrink-0 mt-0.5"
                    >
                      {updatingActionItem === action.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      ) : action.status === 'COMPLETED' ? (
                        <CheckSquare className="h-5 w-5 text-green-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400 hover:text-primary-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium ${
                          action.status === 'COMPLETED'
                            ? 'text-gray-500 line-through'
                            : 'text-gray-900'
                        }`}
                      >
                        {action.title}
                      </p>
                      {action.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {action.description}
                        </p>
                      )}
                      {action.assigneeName && (
                        <p className="text-xs text-gray-500 mt-2">
                          担当: {action.assigneeName}
                          {action.assigneeEmail && ` (${action.assigneeEmail})`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
