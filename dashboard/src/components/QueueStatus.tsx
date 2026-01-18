'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export function QueueStatus() {
  const [stats, setStats] = useState<QueueStats>({
    waiting: 2,
    active: 1,
    completed: 21,
    failed: 0,
  });

  // 実際はAPIから取得
  // useEffect(() => {
  //   fetch('/api/queue/status')
  //     .then(res => res.json())
  //     .then(setStats);
  // }, []);

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
        <div className="mt-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{
                width: `${
                  (stats.completed /
                    (stats.waiting + stats.active + stats.completed + stats.failed)) *
                  100
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">
            {Math.round(
              (stats.completed /
                (stats.waiting + stats.active + stats.completed + stats.failed)) *
                100
            )}
            % 完了
          </p>
        </div>
      </div>
    </div>
  );
}
