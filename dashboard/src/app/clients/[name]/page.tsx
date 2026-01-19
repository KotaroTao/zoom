'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  ArrowLeft,
  Video,
  Clock,
  Calendar,
  ExternalLink,
  FileText,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { getClient, type Recording } from '@/lib/api';

interface ClientDetailPageProps {
  params: Promise<{ name: string }>;
}

export default function ClientPage({ params }: ClientDetailPageProps) {
  const { name } = use(params);
  const clientName = decodeURIComponent(name);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState({
    recordingCount: 0,
    totalDuration: 0,
    completedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const data = await getClient(clientName);
        setRecordings(data.recordings);
        setStats(data.stats);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch client:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch client');
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientName]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="card bg-red-50 border-red-200">
          <div className="card-body text-red-700 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        </div>
        <Link href="/clients" className="mt-4 inline-flex items-center text-primary-600 hover:text-primary-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          クライアント一覧に戻る
        </Link>
      </div>
    );
  }

  const lastMeeting = recordings[0]?.meetingDate;

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-8">
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          クライアント一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{clientName}</h1>
        <p className="text-gray-500 mt-1">クライアントのミーティング履歴</p>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <Video className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">録画数</p>
              <p className="text-xl font-bold text-gray-900">{stats.recordingCount}件</p>
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
              <p className="text-xl font-bold text-gray-900">{stats.totalDuration}分</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-green-50 rounded-lg mr-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">完了</p>
              <p className="text-xl font-bold text-gray-900">{stats.completedCount}件</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-orange-50 rounded-lg mr-3">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">最終MTG</p>
              <p className="text-xl font-bold text-gray-900">
                {lastMeeting
                  ? format(new Date(lastMeeting), 'M/d', { locale: ja })
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 録画一覧 */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">ミーティング履歴</h2>
        </div>
        {recordings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            録画がありません
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recordings.map((recording) => (
              <div key={recording.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-gray-400" />
                      <Link
                        href={`/recordings/${recording.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-primary-600"
                      >
                        {recording.title}
                      </Link>
                      <StatusBadge status={recording.status} />
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(recording.meetingDate), 'yyyy/M/d HH:mm', {
                        locale: ja,
                      })}
                      <span className="mx-2">・</span>
                      <Clock className="h-4 w-4 mr-1" />
                      {recording.duration ? `${recording.duration}分` : '-'}
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="flex items-center space-x-2 ml-4">
                    {recording.youtubeUrl && (
                      <a
                        href={recording.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg"
                        title="YouTubeで見る"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    )}
                    <Link
                      href={`/recordings/${recording.id}`}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                      title="詳細を表示"
                    >
                      <FileText className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
