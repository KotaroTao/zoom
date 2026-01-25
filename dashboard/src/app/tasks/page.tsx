'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Filter,
  Calendar,
  User,
  Building2,
  ChevronDown,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  meeting: {
    id: string;
    name: string;
    circlebackCreatedAt: string;
  };
  client: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  color: string | null;
}

export default function TasksPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [overdueSummary, setOverdueSummary] = useState(0);

  // フィルター
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('PENDING');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (clientFilter) params.set('clientId', clientFilter);
      if (overdueOnly) params.set('overdue', 'true');

      const res = await fetch(`/api/action-items?${params}`);
      const data = await res.json();

      setItems(data.items || []);
      setTotal(data.total || 0);
      setOverdueSummary(data.overdueSummary || 0);
    } catch (error) {
      console.error('Failed to fetch action items:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, clientFilter, overdueOnly]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const toggleStatus = async (item: ActionItem) => {
    const newStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await fetch(`/api/action-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: newStatus, isOverdue: newStatus === 'PENDING' && i.isOverdue } : i
        )
      );
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}日超過`, color: 'text-red-600 bg-red-50' };
    } else if (diffDays === 0) {
      return { text: '今日', color: 'text-orange-600 bg-orange-50' };
    } else if (diffDays === 1) {
      return { text: '明日', color: 'text-yellow-600 bg-yellow-50' };
    } else if (diffDays <= 7) {
      return { text: `${diffDays}日後`, color: 'text-blue-600 bg-blue-50' };
    }
    return { text: `${date.getMonth() + 1}/${date.getDate()}`, color: 'text-gray-600 bg-gray-50' };
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">タスク管理</h1>
            <p className="text-gray-500 mt-1">ミーティングから抽出されたアクションアイテム</p>
          </div>
          {overdueSummary > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-red-700 font-medium">{overdueSummary}件の期限切れタスク</span>
            </div>
          )}
        </div>

        {/* フィルター */}
        <div className="mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* ステータスタブ */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['PENDING', 'COMPLETED', 'ALL'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {status === 'PENDING' ? '未完了' : status === 'COMPLETED' ? '完了' : 'すべて'}
                </button>
              ))}
            </div>

            {/* 期限切れフィルタ */}
            <button
              onClick={() => setOverdueOnly(!overdueOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                overdueOnly
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Clock className="h-4 w-4" />
              期限切れのみ
            </button>

            {/* クライアントフィルタ */}
            <div className="relative">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="appearance-none pl-10 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">すべてのクライアント</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* タスク一覧 */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
            <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {statusFilter === 'COMPLETED'
                ? '完了したタスクはありません'
                : overdueOnly
                ? '期限切れのタスクはありません'
                : 'タスクはありません'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const dueInfo = formatDueDate(item.dueDate);
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-4 p-4 bg-white rounded-lg border transition-all ${
                    item.isOverdue
                      ? 'border-red-200 bg-red-50/30'
                      : item.status === 'COMPLETED'
                      ? 'border-gray-100 bg-gray-50'
                      : 'border-gray-200 hover:border-primary-200'
                  }`}
                >
                  {/* チェックボックス */}
                  <button
                    onClick={() => toggleStatus(item)}
                    className="flex-shrink-0 mt-0.5"
                  >
                    {item.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <Circle className="h-6 w-6 text-gray-300 hover:text-primary-500" />
                    )}
                  </button>

                  {/* コンテンツ */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p
                          className={`font-medium ${
                            item.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-900'
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      {dueInfo && (
                        <span
                          className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium ${dueInfo.color}`}
                        >
                          {dueInfo.text}
                        </span>
                      )}
                    </div>

                    {/* メタ情報 */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {item.client && (
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: item.client.color ? `${item.client.color}20` : '#f3f4f6',
                            color: item.client.color || '#6b7280',
                          }}
                        >
                          <Building2 className="h-3 w-3" />
                          {item.client.name}
                        </span>
                      )}
                      {item.assigneeName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.assigneeName}
                        </span>
                      )}
                      <Link
                        href={`/circleback/${item.meeting.id}`}
                        className="flex items-center gap-1 hover:text-primary-600"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {item.meeting.name}
                      </Link>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.meeting.circlebackCreatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 件数表示 */}
        {!loading && items.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 text-center">
            {total}件中 {items.length}件を表示
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
