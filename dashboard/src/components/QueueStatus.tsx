'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { getQueueStatus } from '@/lib/api';

export function QueueStatus() {
  const [stats, setStats] = useState({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueueStatus = async () => {
    try {
      const data = await getQueueStatus();
      setStats(data.counts);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch queue status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStatus();
    // 10秒ごとに更新
    const interval = setInterval(fetchQueueStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const total = stats.waiting + stats.active + stats.completed + stats.failed;
  const completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">処理キュー</h2>
        <button
          onClick={fetchQueueStatus}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          title="更新"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="card-body">
        {error && (
          <div className="text-red-600 text-sm mb-4">{error}</div>
        )}

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
