'use client';

import { Users, ChevronRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface WeeklyClient {
  clientName: string;
  recordingCount: number;
}

interface WeeklyClientActivityProps {
  clients: WeeklyClient[];
}

export function WeeklyClientActivity({ clients }: WeeklyClientActivityProps) {
  const totalMeetings = clients.reduce((sum, c) => sum + c.recordingCount, 0);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          <h2 className="font-bold text-lg">今週のクライアント活動</h2>
        </div>
        {totalMeetings > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            {clients.length}クライアント・{totalMeetings}件のミーティング
          </p>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>今週のミーティングはありません</p>
        </div>
      ) : (
        <div className="divide-y">
          {clients.map((client, index) => (
            <Link
              key={client.clientName}
              href={`/clients/${encodeURIComponent(client.clientName)}`}
              className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-500'
              }`}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate group-hover:text-blue-600 transition-colors">
                  {client.clientName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm font-medium">
                  {client.recordingCount}件
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {clients.length > 0 && (
        <div className="p-3 border-t bg-gray-50">
          <Link
            href="/clients"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
          >
            すべてのクライアントを見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
