'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Users, Video, Clock, ChevronRight } from 'lucide-react';

interface Client {
  name: string;
  recordingCount: number;
  totalDuration: number;
  lastMeetingDate: string;
}

// モックデータ
const mockClients: Client[] = [
  {
    name: 'ABC商事',
    recordingCount: 12,
    totalDuration: 540,
    lastMeetingDate: '2024-01-15T14:00:00Z',
  },
  {
    name: 'XYZ株式会社',
    recordingCount: 8,
    totalDuration: 360,
    lastMeetingDate: '2024-01-14T10:00:00Z',
  },
  {
    name: 'DEF工業',
    recordingCount: 5,
    totalDuration: 180,
    lastMeetingDate: '2024-01-13T15:30:00Z',
  },
  {
    name: 'GHI商会',
    recordingCount: 3,
    totalDuration: 120,
    lastMeetingDate: '2024-01-10T11:00:00Z',
  },
  {
    name: 'JKL貿易',
    recordingCount: 2,
    totalDuration: 90,
    lastMeetingDate: '2024-01-05T16:00:00Z',
  },
];

export default function ClientsPage() {
  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">クライアント一覧</h1>
        <p className="text-gray-500 mt-1">
          クライアント別のミーティング履歴を確認
        </p>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">総クライアント数</p>
              <p className="text-xl font-bold text-gray-900">
                {mockClients.length}社
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body flex items-center">
            <div className="p-2 bg-green-50 rounded-lg mr-3">
              <Video className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">総録画数</p>
              <p className="text-xl font-bold text-gray-900">
                {mockClients.reduce((acc, c) => acc + c.recordingCount, 0)}件
              </p>
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
              <p className="text-xl font-bold text-gray-900">
                {Math.round(
                  mockClients.reduce((acc, c) => acc + c.totalDuration, 0) / 60
                )}
                時間
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* クライアントリスト */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">クライアント</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  クライアント名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  録画数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  総時間
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  最終MTG
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mockClients.map((client) => (
                <tr key={client.name} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-medium">
                          {client.name.charAt(0)}
                        </span>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {client.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">
                      {client.recordingCount}件
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">
                      {Math.round(client.totalDuration / 60)}時間
                      {client.totalDuration % 60}分
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">
                      {format(new Date(client.lastMeetingDate), 'yyyy/M/d', {
                        locale: ja,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/clients/${encodeURIComponent(client.name)}`}
                      className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                    >
                      詳細
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
