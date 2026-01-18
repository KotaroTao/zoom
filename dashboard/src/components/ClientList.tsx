'use client';

import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';

interface Client {
  name: string;
  recordingCount: number;
  lastMeeting: string;
}

// モックデータ
const mockClients: Client[] = [
  { name: 'ABC商事', recordingCount: 12, lastMeeting: '2024-01-15' },
  { name: 'XYZ株式会社', recordingCount: 8, lastMeeting: '2024-01-14' },
  { name: 'DEF工業', recordingCount: 5, lastMeeting: '2024-01-13' },
  { name: 'GHI商会', recordingCount: 3, lastMeeting: '2024-01-10' },
];

export function ClientList() {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">クライアント</h2>
        <Link
          href="/clients"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          すべて表示
        </Link>
      </div>
      <div className="divide-y divide-gray-200">
        {mockClients.map((client) => (
          <Link
            key={client.name}
            href={`/clients/${encodeURIComponent(client.name)}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {client.name}
                </p>
                <p className="text-xs text-gray-500">
                  {client.recordingCount}件の録画
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
