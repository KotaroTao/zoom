'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { api, QueueStatus as QueueStatusType } from '@/lib/api';

export function QueueStatus() {
  const [stats, setStats] = useState<QueueStatusType>({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        const data = await api.getQueueStatus();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch queue status:', err);
        setError('キュー状態の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchQueueStatus();
    // 10秒ごとに更新
    const interval = setInterval(fetchQueueStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const total = stats.waiting + stats.active + stats.completed + stats.failed;
  const completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">処理キュー</h2>
        </div>
        <div className="card-body flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">処理キュー</h2>
        </div>
        <div className="card-body text-center text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900">処理キュー</h2>
      </div>
      <div className="card-body">
        <div className="space-y-4">
          {/* 処理中 */}
          {stats.active > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin mr-2" />
                <span className="text-sm text-gray-600">処理中</span>
              </div>
              <span className="text-sm font-medium text-blue-600">
                {stats.active}件
              </span>
            </div>
          )}

          {/* 待機中 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-yellow-500 mr-2" />
              <span className="text-sm text-gray-600">待機中</span>
            </div>
            <span className="text-sm font-medium text-yellow-600">
              {stats.waiting}件
            </span>
          </div>

          {/* 完了 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm text-gray-600">完了</span>
            </div>
            <span className="text-sm font-medium text-green-600">
              {stats.completed}件
            </span>
          </div>

          {/* 失敗 */}
          {stats.failed > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm text-gray-600">失敗</span>
              </div>
              <span className="text-sm font-medium text-red-600">
                {stats.failed}件
              </span>
            </div>
          )}
        </div>

        {/* プログレスバー */}
        {total > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {completionRate}% 完了
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
