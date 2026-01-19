'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, Loader2 } from 'lucide-react';
import { getClients, type Client } from '@/lib/api';

export function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await getClients();
        setClients(data.clients.slice(0, 5)); // 最大5件表示
        setError(null);
      } catch (err) {
        console.error('Failed to fetch clients:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

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

      {error && (
        <div className="p-4 text-red-600 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          クライアントがありません
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {clients.map((client) => (
            <Link
              key={client.name}
              href={`/clients/${encodeURIComponent(client.name || '')}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: client.color ? `${client.color}20` : '#e0e7ff',
                    color: client.color || '#4f46e5'
                  }}
                >
                  <Users className="h-4 w-4" />
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
      )}
    </div>
  );
}
