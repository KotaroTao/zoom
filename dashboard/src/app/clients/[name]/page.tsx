'use client';

import { useParams } from 'next/navigation';
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
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

interface Recording {
  id: string;
  title: string;
  meetingDate: string;
  youtubeUrl: string | null;
  summary: string | null;
  status: string;
  duration: number | null;
}

// モックデータ
const mockRecordings: Recording[] = [
  {
    id: '1',
    title: '【ABC商事】定例MTG - 1月第3週',
    meetingDate: '2024-01-15T14:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=xxx',
    summary: '## 概要\n今週の進捗確認と次週の計画について議論。\n\n## 主な議論\n- プロジェクトAの進捗は予定通り\n- 新規案件の見積もり依頼あり\n\n## アクションアイテム\n- [ ] 見積もり作成（田中、1/18まで）',
    status: 'COMPLETED',
    duration: 45,
  },
  {
    id: '2',
    title: '【ABC商事】定例MTG - 1月第2週',
    meetingDate: '2024-01-08T14:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=yyy',
    summary: '## 概要\n年始挨拶と今年の計画について。\n\n## 主な議論\n- 2024年の予算計画\n- 新システム導入の検討',
    status: 'COMPLETED',
    duration: 60,
  },
  {
    id: '3',
    title: '【ABC商事】緊急MTG',
    meetingDate: '2024-01-05T10:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=zzz',
    summary: null,
    status: 'TRANSCRIBING',
    duration: 30,
  },
];

export default function ClientPage() {
  const params = useParams();
  const clientName = decodeURIComponent(params.name as string);

  // 統計を計算
  const totalRecordings = mockRecordings.length;
  const totalDuration = mockRecordings.reduce((acc, r) => acc + (r.duration || 0), 0);
  const lastMeeting = mockRecordings[0]?.meetingDate;

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <Video className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">録画数</p>
              <p className="text-xl font-bold text-gray-900">{totalRecordings}件</p>
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
              <p className="text-xl font-bold text-gray-900">{totalDuration}分</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-green-50 rounded-lg mr-3">
              <Calendar className="h-5 w-5 text-green-600" />
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
        <div className="divide-y divide-gray-200">
          {mockRecordings.map((recording) => (
            <div key={recording.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <Play className="h-4 w-4 text-gray-400 mr-2" />
                    <h3 className="text-sm font-medium text-gray-900">
                      {recording.title}
                    </h3>
                    <StatusBadge status={recording.status} />
                  </div>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(recording.meetingDate), 'yyyy/M/d HH:mm', {
                      locale: ja,
                    })}
                    <span className="mx-2">•</span>
                    <Clock className="h-4 w-4 mr-1" />
                    {recording.duration}分
                  </div>

                  {/* 要約プレビュー */}
                  {recording.summary && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">
                        {recording.summary.substring(0, 200)}...
                      </p>
                    </div>
                  )}
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
                  {recording.summary && (
                    <button
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                      title="要約を表示"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
