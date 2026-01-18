'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

interface Recording {
  id: string;
  title: string;
  clientName: string | null;
  meetingDate: string;
  youtubeUrl: string | null;
  zoomUrl: string;
  status: string;
  duration: number | null;
  hasSummary: boolean;
}

// モックデータ
const mockRecordings: Recording[] = [
  {
    id: '1',
    title: '【ABC商事】定例MTG',
    clientName: 'ABC商事',
    meetingDate: '2024-01-15T14:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=xxx',
    zoomUrl: 'https://zoom.us/rec/share/xxx',
    status: 'COMPLETED',
    duration: 45,
    hasSummary: true,
  },
  {
    id: '2',
    title: '【XYZ株式会社】商談',
    clientName: 'XYZ株式会社',
    meetingDate: '2024-01-14T10:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=yyy',
    zoomUrl: 'https://zoom.us/rec/share/yyy',
    status: 'COMPLETED',
    duration: 60,
    hasSummary: true,
  },
  {
    id: '3',
    title: '【DEF工業】プロジェクト進捗',
    clientName: 'DEF工業',
    meetingDate: '2024-01-13T15:30:00Z',
    youtubeUrl: null,
    zoomUrl: 'https://zoom.us/rec/share/zzz',
    status: 'TRANSCRIBING',
    duration: 30,
    hasSummary: false,
  },
  {
    id: '4',
    title: '社内定例会議',
    clientName: null,
    meetingDate: '2024-01-12T09:00:00Z',
    youtubeUrl: null,
    zoomUrl: 'https://zoom.us/rec/share/aaa',
    status: 'PENDING',
    duration: 90,
    hasSummary: false,
  },
  {
    id: '5',
    title: '【GHI商会】契約更新',
    clientName: 'GHI商会',
    meetingDate: '2024-01-11T13:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=bbb',
    zoomUrl: 'https://zoom.us/rec/share/bbb',
    status: 'COMPLETED',
    duration: 25,
    hasSummary: true,
  },
];

export default function RecordingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRecordings = mockRecordings.filter((recording) => {
    const matchesSearch =
      recording.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recording.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || recording.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
                <option value="all">すべて</option>
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

      {/* 録画リスト */}
      <div className="card">
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
                      {recording.hasSummary && (
                        <button
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                          title="要約を表示"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                      <a
                        href={recording.zoomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-lg"
                        title="Zoomで見る"
                      >
                        <Download className="h-4 w-4" />
                      </a>
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
      </div>
    </div>
  );
}
