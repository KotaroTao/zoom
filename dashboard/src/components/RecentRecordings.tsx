'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Play, ExternalLink, FileText } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface Recording {
  id: string;
  title: string;
  clientName: string | null;
  meetingDate: string;
  youtubeUrl: string | null;
  status: string;
  duration: number | null;
}

// モックデータ（実際はAPIから取得）
const mockRecordings: Recording[] = [
  {
    id: '1',
    title: '【ABC商事】定例MTG',
    clientName: 'ABC商事',
    meetingDate: '2024-01-15T14:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=xxx',
    status: 'COMPLETED',
    duration: 45,
  },
  {
    id: '2',
    title: '【XYZ株式会社】商談',
    clientName: 'XYZ株式会社',
    meetingDate: '2024-01-14T10:00:00Z',
    youtubeUrl: 'https://youtube.com/watch?v=yyy',
    status: 'COMPLETED',
    duration: 60,
  },
  {
    id: '3',
    title: '【DEF工業】プロジェクト進捗',
    clientName: 'DEF工業',
    meetingDate: '2024-01-13T15:30:00Z',
    youtubeUrl: null,
    status: 'TRANSCRIBING',
    duration: 30,
  },
  {
    id: '4',
    title: '社内定例会議',
    clientName: null,
    meetingDate: '2024-01-12T09:00:00Z',
    youtubeUrl: null,
    status: 'PENDING',
    duration: 90,
  },
];

export function RecentRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>(mockRecordings);

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
                    <button
                      className="p-1 text-gray-400 hover:text-primary-600"
                      title="要約を表示"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
